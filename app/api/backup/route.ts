import { NextResponse } from 'next/server';
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
import { authError, requireMembership } from '@/lib/server-auth';

function error(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
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
      return error('No hay datos para respaldar', 404);
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
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="cerca-respaldo-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (caught) {
    return caught instanceof Error && 'status' in caught
      ? authError(caught)
      : error('No se pudo crear el respaldo', 500);
  }
}

export async function POST(request: Request) {
  try {
    const careGroupId =
      new URL(request.url).searchParams.get('careGroupId') || '';
    await requireMembership(request, careGroupId, 'admin');
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 5_000_000)
      return error('El archivo supera el límite de 5 MB', 400);
    const parsed = backupImportSchema.safeParse(await request.json());
    if (!parsed.success)
      return error(
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
    await db.batch([
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
      ...backup.persons.map((person) =>
        db
          .prepare(
            'INSERT INTO persons (id, care_group_id, name, birth_date, relationship, notes, archived, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
          )
          .bind(
            personIds.get(person.id),
            careGroupId,
            person.name,
            person.birthDate,
            person.relationship,
            person.notes,
            person.archived ? 1 : 0,
          ),
      ),
      ...backup.appointments.map((item) =>
        db
          .prepare(
            'INSERT INTO appointments (id, person_id, specialty, doctor, date, time, place, bring, notes, status, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
          )
          .bind(
            appointmentIds.get(item.id),
            personIds.get(item.personId),
            item.specialty,
            item.doctor,
            item.date,
            item.time,
            item.place,
            item.bring,
            item.notes,
            item.status,
          ),
      ),
      ...backup.medications.map((item) =>
        db
          .prepare(
            'INSERT INTO medications (id, person_id, name, dose, frequency, doctor, notes, active, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
          )
          .bind(
            medicationIds.get(item.id),
            personIds.get(item.personId),
            item.name,
            item.dose,
            item.frequency,
            item.doctor,
            item.notes,
            item.active ? 1 : 0,
          ),
      ),
      ...backup.tasks.map((item) =>
        db
          .prepare(
            'INSERT INTO tasks (id, person_id, title, due_date, priority, status, notes, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
          )
          .bind(
            crypto.randomUUID(),
            personIds.get(item.personId),
            item.title,
            item.dueDate,
            item.priority,
            item.status,
            item.notes,
          ),
      ),
      ...backup.orders.map((item) =>
        db
          .prepare(
            'INSERT INTO medical_orders (id, person_id, specialty, reason, requested_by, issue_date, expiration_date, notes, status, appointment_id, used_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
          )
          .bind(
            crypto.randomUUID(),
            personIds.get(item.personId),
            item.specialty,
            item.reason,
            item.requestedBy,
            item.issueDate,
            item.expirationDate,
            item.notes,
            item.status,
            item.appointmentId
              ? appointmentIds.get(item.appointmentId) || null
              : null,
            item.usedAt,
          ),
      ),
      ...backup.prescriptions.map((item) =>
        db
          .prepare(
            'INSERT INTO prescriptions (id, person_id, medication_name, presentation, dose, frequency, duration, prescribed_by, issue_date, expiration_date, notes, status, medication_id, used_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
          )
          .bind(
            crypto.randomUUID(),
            personIds.get(item.personId),
            item.medicationName,
            item.presentation,
            item.dose,
            item.frequency,
            item.duration,
            item.prescribedBy,
            item.issueDate,
            item.expirationDate,
            item.notes,
            item.status,
            item.medicationId
              ? medicationIds.get(item.medicationId) || null
              : null,
            item.usedAt,
          ),
      ),
    ]);
    await db.prepare('PRAGMA optimize').run();
    return NextResponse.json({ ok: true });
  } catch (caught) {
    if (caught instanceof Error && 'status' in caught) return authError(caught);
    return error(
      'No se pudo restaurar el respaldo; tus datos actuales no fueron modificados',
      500,
    );
  }
}
