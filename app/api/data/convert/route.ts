import { z } from 'zod';
import { getD1 } from '@/db';
import type { Appointment, Medication } from '@/lib/models';
import {
  appointmentSchema,
  fieldErrors,
  medicationSchema,
} from '@/lib/validation';
import { requireMembership, requireSameOrigin } from '@/lib/server-auth';
import { handleApiError, jsonError, readJson } from '@/lib/api-response';
import { toStockMilli } from '@/lib/medications';

const conversionSchema = z.object({
  sourceEntity: z.enum(['order', 'prescription']),
  sourceId: z.uuid(),
  personId: z.uuid(),
  careGroupId: z.uuid(),
  version: z.number().int().positive(),
  data: z.unknown(),
});

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = conversionSchema.safeParse(await readJson(request));
    if (!body.success)
      return jsonError('La conversión solicitada no es válida', 400);
    await requireMembership(request, body.data.careGroupId);
    const db = getD1();
    const person = await db
      .prepare(
        'SELECT id FROM persons WHERE id = ? AND care_group_id = ? AND archived = 0',
      )
      .bind(body.data.personId, body.data.careGroupId)
      .first();
    if (!person) return jsonError('La persona no existe o está archivada', 404);

    const isOrder = body.data.sourceEntity === 'order';
    const sourceTable = isOrder ? 'medical_orders' : 'prescriptions';
    const source = await db
      .prepare(
        `SELECT status, expiration_date AS expirationDate, version FROM ${sourceTable} WHERE id = ? AND person_id = ?`,
      )
      .bind(body.data.sourceId, body.data.personId)
      .first<{
        status: 'pending' | 'used';
        expirationDate: string;
        version: number;
      }>();
    if (!source)
      return jsonError('El documento no existe para esta persona', 404);
    if (source.status === 'used')
      return jsonError('Este documento ya fue utilizado', 409);
    if (source.expirationDate < todayInArgentina())
      return jsonError('El documento está vencido', 409);
    if (source.version !== body.data.version)
      return jsonError(
        'El documento cambió en otro dispositivo. Recargá e intentá nuevamente.',
        409,
      );

    const targetId = crypto.randomUUID();
    const usedAt = new Date().toISOString();
    const today = todayInArgentina();
    if (isOrder) {
      const parsed = appointmentSchema.safeParse(body.data.data);
      if (!parsed.success)
        return jsonError(
          'Revisá los campos marcados',
          400,
          fieldErrors(parsed.error),
        );
      const item = parsed.data as Omit<Appointment, 'id' | 'personId'>;
      const results = await db.batch([
        db
          .prepare(
            `INSERT INTO appointments (id, person_id, specialty, doctor, date, time, place, bring, notes, status, version)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1
             WHERE EXISTS (
               SELECT 1 FROM medical_orders
               WHERE id = ? AND person_id = ? AND status = 'pending'
                 AND expiration_date >= ? AND version = ?
             )`,
          )
          .bind(
            targetId,
            body.data.personId,
            item.specialty,
            item.doctor,
            item.date,
            item.time,
            item.place,
            item.bring,
            item.notes,
            item.status,
            body.data.sourceId,
            body.data.personId,
            today,
            body.data.version,
          ),
        db
          .prepare(
            `UPDATE medical_orders
             SET status = 'used', appointment_id = ?, used_at = ?, version = version + 1
             WHERE id = ? AND person_id = ? AND status = 'pending'
               AND expiration_date >= ? AND version = ?
               AND EXISTS (SELECT 1 FROM appointments WHERE id = ?)`,
          )
          .bind(
            targetId,
            usedAt,
            body.data.sourceId,
            body.data.personId,
            today,
            body.data.version,
            targetId,
          ),
      ]);
      if (!results[0].meta.changes || !results[1].meta.changes)
        return jsonError('La orden ya no está disponible para convertir', 409);
    } else {
      const parsed = medicationSchema.safeParse(body.data.data);
      if (!parsed.success)
        return jsonError(
          'Revisá los campos marcados',
          400,
          fieldErrors(parsed.error),
        );
      const item = parsed.data as Omit<Medication, 'id' | 'personId'>;
      const statements = [
        db
          .prepare(
            `INSERT INTO medications (
               id, person_id, name, dose, frequency, doctor, notes, active,
               schedule_type, start_date, end_date, interval_minutes,
               interval_anchor_at, presentation, stock_unit,
               units_per_intake_milli, stock_quantity_milli,
               reorder_threshold_milli, stock_cycle, version)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1
             WHERE EXISTS (
               SELECT 1 FROM prescriptions
               WHERE id = ? AND person_id = ? AND status = 'pending'
                 AND expiration_date >= ? AND version = ?
             )`,
          )
          .bind(
            targetId,
            body.data.personId,
            item.name,
            item.dose,
            item.frequency,
            item.doctor,
            item.notes,
            item.active ? 1 : 0,
            item.scheduleType,
            item.startDate,
            item.endDate,
            item.intervalMinutes,
            item.intervalAnchorAt,
            item.presentation,
            item.stockUnit,
            toStockMilli(item.unitsPerIntake),
            toStockMilli(item.stockQuantity),
            toStockMilli(item.reorderThreshold),
            body.data.sourceId,
            body.data.personId,
            today,
            body.data.version,
          ),
        ...item.scheduleTimes.map((time, position) =>
          db
            .prepare(
              `INSERT INTO medication_schedule_times
                 (id, medication_id, local_time, position)
               SELECT ?, ?, ?, ? WHERE EXISTS
                 (SELECT 1 FROM medications WHERE id = ?)`,
            )
            .bind(crypto.randomUUID(), targetId, time, position, targetId),
        ),
        ...(item.stockQuantity
          ? [
              db
                .prepare(
                  `INSERT INTO medication_stock_movements
                     (id, medication_id, intake_id, delta_milli, reason,
                      recorded_by_user_id, recorded_at)
                   SELECT ?, ?, NULL, ?, 'initial', NULL, ? WHERE EXISTS
                     (SELECT 1 FROM medications WHERE id = ?)`,
                )
                .bind(
                  crypto.randomUUID(),
                  targetId,
                  toStockMilli(item.stockQuantity),
                  usedAt,
                  targetId,
                ),
            ]
          : []),
        db
          .prepare(
            `UPDATE prescriptions
             SET status = 'used', medication_id = ?, used_at = ?, version = version + 1
             WHERE id = ? AND person_id = ? AND status = 'pending'
               AND expiration_date >= ? AND version = ?
               AND EXISTS (SELECT 1 FROM medications WHERE id = ?)`,
          )
          .bind(
            targetId,
            usedAt,
            body.data.sourceId,
            body.data.personId,
            today,
            body.data.version,
            targetId,
          ),
      ];
      const results = await db.batch(statements);
      if (!results[0].meta.changes || !results[results.length - 1].meta.changes)
        return jsonError('La receta ya no está disponible para convertir', 409);
    }
    return Response.json({ id: targetId }, { status: 201 });
  } catch (caught) {
    return handleApiError(caught, 'No se pudo convertir el documento');
  }
}
