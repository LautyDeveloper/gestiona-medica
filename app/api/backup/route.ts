import { getD1 } from '@/db';
import type {
  Appointment,
  BackupData,
  MedicalOrder,
  MedicalTask,
  MedicationIntake,
  MedicationStockMovement,
  Person,
  Prescription,
} from '@/lib/models';
import { backupImportSchema, fieldErrors } from '@/lib/validation';
import { requireMembership, requireSameOrigin } from '@/lib/server-auth';
import { PayloadTooLargeError, readJsonWithLimit } from '@/lib/request-body';
import { handleApiError, jsonError } from '@/lib/api-response';
import { fromStockMilli } from '@/lib/medications';
import {
  hydrateMedications,
  MEDICATION_SELECT,
  type RawMedication,
  type RawScheduleTime,
} from '@/lib/server-medications';

const MAX_BACKUP_BYTES = 5_000_000;
const JSON_CHUNK_BYTES = 750_000;

function jsonChunks(items: unknown[]) {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let chunk: unknown[] = [];
  let chunkBytes = 2;
  for (const item of items) {
    const itemBytes = encoder.encode(JSON.stringify(item)).byteLength;
    if (chunk.length && chunkBytes + itemBytes + 1 > JSON_CHUNK_BYTES) {
      chunks.push(JSON.stringify(chunk));
      chunk = [];
      chunkBytes = 2;
    }
    chunk.push(item);
    chunkBytes += itemBytes + (chunk.length > 1 ? 1 : 0);
  }
  if (chunk.length) chunks.push(JSON.stringify(chunk));
  return chunks;
}

export async function GET(request: Request) {
  try {
    const careGroupId =
      new URL(request.url).searchParams.get('careGroupId') || '';
    await requireMembership(request, careGroupId);
    const db = getD1();
    const [
      group,
      people,
      appointments,
      orders,
      medications,
      prescriptions,
      tasks,
      medicationTimes,
      medicationIntakes,
      medicationStockMovements,
    ] = await Promise.all([
      db
        .prepare('SELECT name FROM care_groups WHERE id = ?')
        .bind(careGroupId)
        .first<{ name: string }>(),
      db
        .prepare(
          'SELECT id, name, birth_date AS birthDate, relationship, notes, archived FROM persons WHERE care_group_id = ? ORDER BY archived, name COLLATE NOCASE',
        )
        .bind(careGroupId)
        .all<Omit<Person, 'archived'> & { archived: number }>(),
      db
        .prepare(
          'SELECT a.id, a.person_id AS personId, a.specialty, a.doctor, a.date, a.time, a.place, a.bring, a.notes, a.status FROM appointments a JOIN persons p ON p.id = a.person_id WHERE p.care_group_id = ? ORDER BY a.person_id, a.date, a.time',
        )
        .bind(careGroupId)
        .all<Appointment>(),
      db
        .prepare(
          'SELECT o.id, o.person_id AS personId, o.specialty, o.reason, o.requested_by AS requestedBy, o.issue_date AS issueDate, o.expiration_date AS expirationDate, o.notes, o.status, o.appointment_id AS appointmentId, o.used_at AS usedAt FROM medical_orders o JOIN persons p ON p.id = o.person_id WHERE p.care_group_id = ? ORDER BY o.person_id, o.expiration_date',
        )
        .bind(careGroupId)
        .all<MedicalOrder>(),
      db
        .prepare(
          `SELECT m.* FROM (SELECT ${MEDICATION_SELECT} FROM medications) m
           JOIN persons p ON p.id = m.personId WHERE p.care_group_id = ?
           ORDER BY m.personId, m.name`,
        )
        .bind(careGroupId)
        .all<RawMedication>(),
      db
        .prepare(
          'SELECT r.id, r.person_id AS personId, r.medication_name AS medicationName, r.presentation, r.dose, r.frequency, r.duration, r.prescribed_by AS prescribedBy, r.issue_date AS issueDate, r.expiration_date AS expirationDate, r.notes, r.status, r.medication_id AS medicationId, r.used_at AS usedAt FROM prescriptions r JOIN persons p ON p.id = r.person_id WHERE p.care_group_id = ? ORDER BY r.person_id, r.expiration_date',
        )
        .bind(careGroupId)
        .all<Prescription>(),
      db
        .prepare(
          'SELECT t.id, t.person_id AS personId, t.title, t.due_date AS dueDate, t.priority, t.status, t.notes, t.visible_to_elder AS visibleToElder FROM tasks t JOIN persons p ON p.id = t.person_id WHERE p.care_group_id = ? ORDER BY t.person_id, t.due_date',
        )
        .bind(careGroupId)
        .all<MedicalTask>(),
      db
        .prepare(
          `SELECT st.medication_id AS medicationId, st.local_time AS localTime
           FROM medication_schedule_times st JOIN medications m ON m.id = st.medication_id
           JOIN persons p ON p.id = m.person_id WHERE p.care_group_id = ?
           ORDER BY st.medication_id, st.position, st.local_time`,
        )
        .bind(careGroupId)
        .all<RawScheduleTime>(),
      db
        .prepare(
          `SELECT i.id, i.medication_id AS medicationId,
             i.person_id AS personId, i.scheduled_for AS scheduledFor,
             i.reported_at AS reportedAt, i.status, i.notes,
             i.recorded_by_name AS recordedByName, i.created_at AS createdAt,
             i.voided_at AS voidedAt
           FROM medication_intakes i JOIN persons p ON p.id = i.person_id
           WHERE p.care_group_id = ? ORDER BY i.reported_at`,
        )
        .bind(careGroupId)
        .all<MedicationIntake>(),
      db
        .prepare(
          `SELECT sm.id, sm.medication_id AS medicationId,
             sm.intake_id AS intakeId, sm.delta_milli AS deltaMilli,
             sm.reason, sm.recorded_at AS recordedAt
           FROM medication_stock_movements sm
           JOIN medications m ON m.id = sm.medication_id
           JOIN persons p ON p.id = m.person_id
           WHERE p.care_group_id = ? ORDER BY sm.recorded_at`,
        )
        .bind(careGroupId)
        .all<Omit<MedicationStockMovement, 'delta'> & { deltaMilli: number }>(),
    ]);
    if (!people.results.length)
      return jsonError('No hay datos para respaldar', 404);
    const backup: BackupData = {
      schemaVersion: 6,
      exportedAt: new Date().toISOString(),
      careGroup: { name: group?.name || 'Grupo familiar' },
      persons: people.results.map((person) => ({
        ...person,
        archived: Boolean(person.archived),
      })),
      appointments: appointments.results,
      orders: orders.results,
      medications: hydrateMedications(
        medications.results,
        medicationTimes.results,
      ),
      medicationIntakes: medicationIntakes.results,
      medicationStockMovements: medicationStockMovements.results.map(
        ({ deltaMilli, ...item }) => ({
          ...item,
          delta: fromStockMilli(deltaMilli)!,
        }),
      ),
      prescriptions: prescriptions.results,
      tasks: tasks.results.map((item) => ({
        ...item,
        visibleToElder: Boolean(item.visibleToElder),
      })),
    };
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="cerca-respaldo-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (caught) {
    return handleApiError(caught, 'No se pudo crear el respaldo');
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const careGroupId =
      new URL(request.url).searchParams.get('careGroupId') || '';
    await requireMembership(request, careGroupId, 'admin');
    const parsed = backupImportSchema.safeParse(
      await readJsonWithLimit(request, MAX_BACKUP_BYTES),
    );
    if (!parsed.success)
      return jsonError(
        'El respaldo no es válido o no es compatible',
        400,
        fieldErrors(parsed.error),
      );
    const backup = parsed.data;
    const db = getD1();
    const personIds = new Map(
      backup.persons.map((person) => [person.id, crypto.randomUUID()]),
    );
    const appointmentIds = new Map(
      backup.appointments.map((item) => [item.id, crypto.randomUUID()]),
    );
    const medicationIds = new Map(
      backup.medications.map((item) => [item.id, crypto.randomUUID()]),
    );
    const intakeIds = new Map(
      backup.medicationIntakes.map((item) => [item.id, crypto.randomUUID()]),
    );
    const people = backup.persons.map((person) => ({
      ...person,
      id: personIds.get(person.id),
    }));
    const appointments = backup.appointments.map((item) => ({
      ...item,
      id: appointmentIds.get(item.id),
      personId: personIds.get(item.personId),
    }));
    const medications = backup.medications.map((item) => ({
      ...item,
      id: medicationIds.get(item.id),
      personId: personIds.get(item.personId),
    }));
    const medicationTimes = medications.flatMap((item) =>
      item.scheduleTimes.map((localTime, position) => ({
        id: crypto.randomUUID(),
        medicationId: item.id,
        localTime,
        position,
      })),
    );
    const medicationIntakes = backup.medicationIntakes.map((item) => ({
      ...item,
      id: intakeIds.get(item.id),
      medicationId: medicationIds.get(item.medicationId),
      personId: personIds.get(item.personId),
    }));
    const medicationStockMovements = backup.medicationStockMovements.map(
      (item) => ({
        ...item,
        id: crypto.randomUUID(),
        medicationId: medicationIds.get(item.medicationId),
        intakeId: item.intakeId ? intakeIds.get(item.intakeId) || null : null,
      }),
    );
    const tasks = backup.tasks.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      personId: personIds.get(item.personId),
    }));
    const orders = backup.orders.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      personId: personIds.get(item.personId),
      appointmentId: item.appointmentId
        ? appointmentIds.get(item.appointmentId) || null
        : null,
    }));
    const prescriptions = backup.prescriptions.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      personId: personIds.get(item.personId),
      medicationId: item.medicationId
        ? medicationIds.get(item.medicationId) || null
        : null,
    }));

    const statements = [
      db
        .prepare(
          `DELETE FROM sessions WHERE user_id IN (
            SELECT pa.user_id FROM person_access pa
            JOIN persons p ON p.id = pa.person_id WHERE p.care_group_id = ?
          )`,
        )
        .bind(careGroupId),
      db
        .prepare(
          `DELETE FROM memberships WHERE user_id IN (
            SELECT pa.user_id FROM person_access pa
            JOIN persons p ON p.id = pa.person_id WHERE p.care_group_id = ?
          )`,
        )
        .bind(careGroupId),
      db
        .prepare(
          `DELETE FROM users WHERE user_type = 'elder' AND id IN (
            SELECT pa.user_id FROM person_access pa
            JOIN persons p ON p.id = pa.person_id WHERE p.care_group_id = ?
          )`,
        )
        .bind(careGroupId),
      db
        .prepare(
          'DELETE FROM medical_orders WHERE person_id IN (SELECT id FROM persons WHERE care_group_id = ?)',
        )
        .bind(careGroupId),
      db
        .prepare(
          'DELETE FROM prescriptions WHERE person_id IN (SELECT id FROM persons WHERE care_group_id = ?)',
        )
        .bind(careGroupId),
      db
        .prepare(
          `DELETE FROM medication_stock_movements
           WHERE medication_id IN (
             SELECT m.id FROM medications m JOIN persons p ON p.id = m.person_id
             WHERE p.care_group_id = ?
           )`,
        )
        .bind(careGroupId),
      db
        .prepare(
          'DELETE FROM medication_intakes WHERE person_id IN (SELECT id FROM persons WHERE care_group_id = ?)',
        )
        .bind(careGroupId),
      db
        .prepare(
          `DELETE FROM medication_schedule_times
           WHERE medication_id IN (
             SELECT m.id FROM medications m JOIN persons p ON p.id = m.person_id
             WHERE p.care_group_id = ?
           )`,
        )
        .bind(careGroupId),
      db
        .prepare(
          'DELETE FROM appointments WHERE person_id IN (SELECT id FROM persons WHERE care_group_id = ?)',
        )
        .bind(careGroupId),
      db
        .prepare(
          'DELETE FROM medications WHERE person_id IN (SELECT id FROM persons WHERE care_group_id = ?)',
        )
        .bind(careGroupId),
      db
        .prepare(
          'DELETE FROM tasks WHERE person_id IN (SELECT id FROM persons WHERE care_group_id = ?)',
        )
        .bind(careGroupId),
      db
        .prepare('DELETE FROM persons WHERE care_group_id = ?')
        .bind(careGroupId),
      ...jsonChunks(people).map((chunk) =>
        db
          .prepare(
            `INSERT INTO persons (id, care_group_id, name, birth_date, relationship, notes, archived, version)
             SELECT json_extract(value, '$.id'), ?, json_extract(value, '$.name'),
               json_extract(value, '$.birthDate'), json_extract(value, '$.relationship'),
               json_extract(value, '$.notes'), CASE WHEN json_extract(value, '$.archived') THEN 1 ELSE 0 END, 1
             FROM json_each(?)`,
          )
          .bind(careGroupId, chunk),
      ),
      ...jsonChunks(appointments).map((chunk) =>
        db
          .prepare(
            `INSERT INTO appointments (id, person_id, specialty, doctor, date, time, place, bring, notes, status, version)
             SELECT json_extract(value, '$.id'), json_extract(value, '$.personId'),
               json_extract(value, '$.specialty'), json_extract(value, '$.doctor'),
               json_extract(value, '$.date'), json_extract(value, '$.time'),
               json_extract(value, '$.place'), json_extract(value, '$.bring'),
               json_extract(value, '$.notes'), json_extract(value, '$.status'), 1
             FROM json_each(?)`,
          )
          .bind(chunk),
      ),
      ...jsonChunks(medications).map((chunk) =>
        db
          .prepare(
            `INSERT INTO medications (
               id, person_id, name, dose, frequency, doctor, notes, active,
               schedule_type, start_date, end_date, interval_minutes,
               interval_anchor_at, presentation, stock_unit,
               units_per_intake_milli, stock_quantity_milli,
               reorder_threshold_milli, stock_cycle, version)
             SELECT json_extract(value, '$.id'), json_extract(value, '$.personId'),
               json_extract(value, '$.name'), json_extract(value, '$.dose'),
               json_extract(value, '$.frequency'), json_extract(value, '$.doctor'),
               json_extract(value, '$.notes'),
               CASE WHEN json_extract(value, '$.active') THEN 1 ELSE 0 END,
               json_extract(value, '$.scheduleType'),
               json_extract(value, '$.startDate'), json_extract(value, '$.endDate'),
               json_extract(value, '$.intervalMinutes'),
               json_extract(value, '$.intervalAnchorAt'),
               json_extract(value, '$.presentation'), json_extract(value, '$.stockUnit'),
               CASE WHEN json_type(value, '$.unitsPerIntake') = 'null' THEN NULL
                 ELSE ROUND(json_extract(value, '$.unitsPerIntake') * 1000) END,
               CASE WHEN json_type(value, '$.stockQuantity') = 'null' THEN NULL
                 ELSE ROUND(json_extract(value, '$.stockQuantity') * 1000) END,
               CASE WHEN json_type(value, '$.reorderThreshold') = 'null' THEN NULL
                 ELSE ROUND(json_extract(value, '$.reorderThreshold') * 1000) END,
               COALESCE(json_extract(value, '$.stockCycle'), 1), 1
             FROM json_each(?)`,
          )
          .bind(chunk),
      ),
      ...jsonChunks(medicationTimes).map((chunk) =>
        db
          .prepare(
            `INSERT INTO medication_schedule_times
               (id, medication_id, local_time, position)
             SELECT json_extract(value, '$.id'),
               json_extract(value, '$.medicationId'),
               json_extract(value, '$.localTime'),
               json_extract(value, '$.position')
             FROM json_each(?)`,
          )
          .bind(chunk),
      ),
      ...jsonChunks(medicationIntakes).map((chunk) =>
        db
          .prepare(
            `INSERT INTO medication_intakes (
               id, medication_id, person_id, scheduled_for, reported_at,
               status, notes, recorded_by_user_id, recorded_by_name,
               created_at, voided_at, voided_by_user_id)
             SELECT json_extract(value, '$.id'),
               json_extract(value, '$.medicationId'),
               json_extract(value, '$.personId'),
               json_extract(value, '$.scheduledFor'),
               json_extract(value, '$.reportedAt'), json_extract(value, '$.status'),
               json_extract(value, '$.notes'), NULL,
               json_extract(value, '$.recordedByName'),
               json_extract(value, '$.createdAt'),
               json_extract(value, '$.voidedAt'), NULL
             FROM json_each(?)`,
          )
          .bind(chunk),
      ),
      ...jsonChunks(medicationStockMovements).map((chunk) =>
        db
          .prepare(
            `INSERT INTO medication_stock_movements (
               id, medication_id, intake_id, delta_milli, reason,
               recorded_by_user_id, recorded_at)
             SELECT json_extract(value, '$.id'),
               json_extract(value, '$.medicationId'),
               json_extract(value, '$.intakeId'),
               ROUND(json_extract(value, '$.delta') * 1000),
               json_extract(value, '$.reason'), NULL,
               json_extract(value, '$.recordedAt')
             FROM json_each(?)`,
          )
          .bind(chunk),
      ),
      ...jsonChunks(tasks).map((chunk) =>
        db
          .prepare(
            `INSERT INTO tasks (id, person_id, title, due_date, priority, status, notes, visible_to_elder, version)
             SELECT json_extract(value, '$.id'), json_extract(value, '$.personId'),
               json_extract(value, '$.title'), json_extract(value, '$.dueDate'),
               json_extract(value, '$.priority'), json_extract(value, '$.status'),
               json_extract(value, '$.notes'),
               CASE WHEN json_extract(value, '$.visibleToElder') THEN 1 ELSE 0 END,
               1 FROM json_each(?)`,
          )
          .bind(chunk),
      ),
      ...jsonChunks(orders).map((chunk) =>
        db
          .prepare(
            `INSERT INTO medical_orders (id, person_id, specialty, reason, requested_by, issue_date, expiration_date, notes, status, appointment_id, used_at, version)
             SELECT json_extract(value, '$.id'), json_extract(value, '$.personId'),
               json_extract(value, '$.specialty'), json_extract(value, '$.reason'),
               json_extract(value, '$.requestedBy'), json_extract(value, '$.issueDate'),
               json_extract(value, '$.expirationDate'), json_extract(value, '$.notes'),
               json_extract(value, '$.status'), json_extract(value, '$.appointmentId'),
               json_extract(value, '$.usedAt'), 1 FROM json_each(?)`,
          )
          .bind(chunk),
      ),
      ...jsonChunks(prescriptions).map((chunk) =>
        db
          .prepare(
            `INSERT INTO prescriptions (id, person_id, medication_name, presentation, dose, frequency, duration, prescribed_by, issue_date, expiration_date, notes, status, medication_id, used_at, version)
             SELECT json_extract(value, '$.id'), json_extract(value, '$.personId'),
               json_extract(value, '$.medicationName'), json_extract(value, '$.presentation'),
               json_extract(value, '$.dose'), json_extract(value, '$.frequency'),
               json_extract(value, '$.duration'), json_extract(value, '$.prescribedBy'),
               json_extract(value, '$.issueDate'), json_extract(value, '$.expirationDate'),
               json_extract(value, '$.notes'), json_extract(value, '$.status'),
               json_extract(value, '$.medicationId'), json_extract(value, '$.usedAt'), 1
             FROM json_each(?)`,
          )
          .bind(chunk),
      ),
    ];
    await db.batch(statements);
    return Response.json({ ok: true });
  } catch (caught) {
    if (caught instanceof PayloadTooLargeError)
      return jsonError('El archivo supera el límite de 5 MB', 413);
    if (caught instanceof SyntaxError)
      return jsonError('El archivo no contiene JSON válido', 400);
    return handleApiError(
      caught,
      'No se pudo restaurar el respaldo; tus datos actuales no fueron modificados',
    );
  }
}
