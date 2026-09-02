import { z } from 'zod';
import { getD1 } from '@/db';
import { handleApiError, jsonError, readJson } from '@/lib/api-response';
import { medicationIntakeSchema } from '@/lib/validation';
import { requireSameOrigin } from '@/lib/server-auth';
import {
  recordedBy,
  requireOwnedMedication,
  resolveMedicationPerson,
} from '@/lib/server-medication-access';
import { argentinaDate } from '@/lib/medications';

async function validOccurrence(
  medication: Awaited<ReturnType<typeof requireOwnedMedication>>,
  scheduledFor: string | null,
) {
  if (!medication.active) return false;
  if (medication.scheduleType === 'unstructured') return false;
  if (medication.scheduleType === 'as_needed') return scheduledFor === null;
  if (!scheduledFor) return false;
  const instant = new Date(scheduledFor);
  const date = argentinaDate(instant);
  if (
    (medication.startDate && date < medication.startDate) ||
    (medication.endDate && date > medication.endDate)
  )
    return false;
  if (medication.scheduleType === 'interval') {
    if (!medication.intervalMinutes || !medication.intervalAnchorAt)
      return false;
    const anchor = new Date(`${medication.intervalAnchorAt}:00-03:00`);
    const difference = instant.getTime() - anchor.getTime();
    return (
      difference >= 0 &&
      difference % (medication.intervalMinutes * 60_000) === 0
    );
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Argentina/Buenos_Aires',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const time = `${parts.hour}:${parts.minute}`;
  return Boolean(
    await getD1()
      .prepare(
        `SELECT 1 FROM medication_schedule_times
         WHERE medication_id = ? AND local_time = ?`,
      )
      .bind(medication.id, time)
      .first(),
  );
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = (await readJson(request)) as {
      careGroupId?: string;
      data?: unknown;
    };
    const parsed = medicationIntakeSchema.safeParse(body.data);
    if (!parsed.success) return jsonError('Revisá los datos de la toma', 400);
    const scope = await resolveMedicationPerson(
      request,
      parsed.data.personId,
      body.careGroupId,
    );
    const medication = await requireOwnedMedication(
      parsed.data.medicationId,
      scope.personId,
    );
    if (
      !(await validOccurrence(medication, parsed.data.scheduledFor)) ||
      (medication.scheduleType === 'as_needed' &&
        parsed.data.status !== 'taken')
    )
      return jsonError(
        'La toma no coincide con un plan confirmado para este medicamento',
        400,
      );
    const now = new Date();
    const reported = new Date(parsed.data.reportedAt);
    if (
      reported.getTime() > now.getTime() + 60 * 60_000 ||
      reported.getTime() < now.getTime() - 31 * 86_400_000
    )
      return jsonError(
        'La toma debe estar dentro de los últimos 31 días y no puede ser futura',
        400,
      );
    const id = crypto.randomUUID();
    const createdAt = now.toISOString();
    const db = getD1();
    const shouldConsume =
      parsed.data.status === 'taken' &&
      medication.unitsPerIntakeMilli !== null &&
      medication.stockQuantityMilli !== null;
    const statements = [
      db
        .prepare(
          `INSERT INTO medication_intakes (
             id, medication_id, person_id, scheduled_for, reported_at,
             status, notes, recorded_by_user_id, recorded_by_name, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          parsed.data.medicationId,
          scope.personId,
          parsed.data.scheduledFor,
          parsed.data.reportedAt,
          parsed.data.status,
          parsed.data.notes,
          scope.user.id,
          recordedBy(scope.user),
          createdAt,
        ),
      ...(shouldConsume
        ? [
            db
              .prepare(
                `UPDATE medications
                 SET stock_quantity_milli = stock_quantity_milli - ?,
                   version = version + 1
                 WHERE id = ? AND person_id = ?`,
              )
              .bind(
                medication.unitsPerIntakeMilli,
                medication.id,
                scope.personId,
              ),
            db
              .prepare(
                `INSERT INTO medication_stock_movements
                   (id, medication_id, intake_id, delta_milli, reason,
                    recorded_by_user_id, recorded_at)
                 VALUES (?, ?, ?, ?, 'intake', ?, ?)`,
              )
              .bind(
                crypto.randomUUID(),
                medication.id,
                id,
                -medication.unitsPerIntakeMilli!,
                scope.user.id,
                createdAt,
              ),
          ]
        : []),
    ];
    await db.batch(statements);
    return Response.json({ id }, { status: 201 });
  } catch (caught) {
    if (String(caught).includes('UNIQUE constraint failed'))
      return jsonError('Esta toma ya fue registrada', 409);
    return handleApiError(caught, 'No se pudo registrar la toma');
  }
}

const voidSchema = z.object({
  id: z.uuid(),
  personId: z.uuid().optional(),
  careGroupId: z.uuid().optional(),
});

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = voidSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonError('Solicitud inválida', 400);
    const scope = await resolveMedicationPerson(
      request,
      parsed.data.personId,
      parsed.data.careGroupId,
    );
    const db = getD1();
    const intake = await db
      .prepare(
        `SELECT i.id, i.medication_id AS medicationId, i.status,
           m.units_per_intake_milli AS unitsPerIntakeMilli,
           m.stock_quantity_milli AS stockQuantityMilli
         FROM medication_intakes i JOIN medications m ON m.id = i.medication_id
         WHERE i.id = ? AND i.person_id = ? AND i.voided_at IS NULL`,
      )
      .bind(parsed.data.id, scope.personId)
      .first<{
        id: string;
        medicationId: string;
        status: 'taken' | 'not_taken';
        unitsPerIntakeMilli: number | null;
        stockQuantityMilli: number | null;
      }>();
    if (!intake) return jsonError('El registro ya no está disponible', 404);
    const now = new Date().toISOString();
    const shouldRestore =
      intake.status === 'taken' &&
      intake.unitsPerIntakeMilli !== null &&
      intake.stockQuantityMilli !== null;
    await db.batch([
      db
        .prepare(
          `UPDATE medication_intakes
           SET voided_at = ?, voided_by_user_id = ?
           WHERE id = ? AND person_id = ? AND voided_at IS NULL`,
        )
        .bind(now, scope.user.id, intake.id, scope.personId),
      ...(shouldRestore
        ? [
            db
              .prepare(
                `UPDATE medications
                 SET stock_quantity_milli = stock_quantity_milli + ?,
                   version = version + 1
                 WHERE id = ? AND person_id = ?`,
              )
              .bind(
                intake.unitsPerIntakeMilli,
                intake.medicationId,
                scope.personId,
              ),
            db
              .prepare(
                `INSERT INTO medication_stock_movements
                   (id, medication_id, intake_id, delta_milli, reason,
                    recorded_by_user_id, recorded_at)
                 VALUES (?, ?, NULL, ?, 'correction', ?, ?)`,
              )
              .bind(
                crypto.randomUUID(),
                intake.medicationId,
                intake.unitsPerIntakeMilli!,
                scope.user.id,
                now,
              ),
          ]
        : []),
    ]);
    return Response.json({ ok: true });
  } catch (caught) {
    return handleApiError(caught, 'No se pudo anular el registro');
  }
}
