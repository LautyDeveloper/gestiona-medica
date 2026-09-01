import { getD1 } from '@/db';
import type {
  Appointment,
  BackupData,
  MedicalOrder,
  MedicalTask,
  Medication,
  Person,
  Prescription,
} from '@/lib/models';
import { backupImportSchema, fieldErrors } from '@/lib/validation';
import { requireMembership, requireSameOrigin } from '@/lib/server-auth';
import { PayloadTooLargeError, readJsonWithLimit } from '@/lib/request-body';
import { handleApiError, jsonError } from '@/lib/api-response';

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
          'SELECT m.id, m.person_id AS personId, m.name, m.dose, m.frequency, m.doctor, m.notes, m.active FROM medications m JOIN persons p ON p.id = m.person_id WHERE p.care_group_id = ? ORDER BY m.person_id, m.name',
        )
        .bind(careGroupId)
        .all<Omit<Medication, 'active'> & { active: number }>(),
      db
        .prepare(
          'SELECT r.id, r.person_id AS personId, r.medication_name AS medicationName, r.presentation, r.dose, r.frequency, r.duration, r.prescribed_by AS prescribedBy, r.issue_date AS issueDate, r.expiration_date AS expirationDate, r.notes, r.status, r.medication_id AS medicationId, r.used_at AS usedAt FROM prescriptions r JOIN persons p ON p.id = r.person_id WHERE p.care_group_id = ? ORDER BY r.person_id, r.expiration_date',
        )
        .bind(careGroupId)
        .all<Prescription>(),
      db
        .prepare(
          'SELECT t.id, t.person_id AS personId, t.title, t.due_date AS dueDate, t.priority, t.status, t.notes FROM tasks t JOIN persons p ON p.id = t.person_id WHERE p.care_group_id = ? ORDER BY t.person_id, t.due_date',
        )
        .bind(careGroupId)
        .all<MedicalTask>(),
    ]);
    if (!people.results.length)
      return jsonError('No hay datos para respaldar', 404);
    const backup: BackupData = {
      schemaVersion: 4,
      exportedAt: new Date().toISOString(),
      careGroup: { name: group?.name || 'Grupo familiar' },
      persons: people.results.map((person) => ({
        ...person,
        archived: Boolean(person.archived),
      })),
      appointments: appointments.results,
      orders: orders.results,
      medications: medications.results.map((item) => ({
        ...item,
        active: Boolean(item.active),
      })),
      prescriptions: prescriptions.results,
      tasks: tasks.results,
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
            `INSERT INTO medications (id, person_id, name, dose, frequency, doctor, notes, active, version)
             SELECT json_extract(value, '$.id'), json_extract(value, '$.personId'),
               json_extract(value, '$.name'), json_extract(value, '$.dose'),
               json_extract(value, '$.frequency'), json_extract(value, '$.doctor'),
               json_extract(value, '$.notes'), CASE WHEN json_extract(value, '$.active') THEN 1 ELSE 0 END, 1
             FROM json_each(?)`,
          )
          .bind(chunk),
      ),
      ...jsonChunks(tasks).map((chunk) =>
        db
          .prepare(
            `INSERT INTO tasks (id, person_id, title, due_date, priority, status, notes, version)
             SELECT json_extract(value, '$.id'), json_extract(value, '$.personId'),
               json_extract(value, '$.title'), json_extract(value, '$.dueDate'),
               json_extract(value, '$.priority'), json_extract(value, '$.status'),
               json_extract(value, '$.notes'), 1 FROM json_each(?)`,
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
