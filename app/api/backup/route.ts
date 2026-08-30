import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import type {
  Appointment,
  BackupData,
  MedicalTask,
  Medication,
  Person,
} from '@/lib/models';
import { backupSchema, fieldErrors } from '@/lib/validation';

function error(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function GET() {
  try {
    const db = getD1();
    const person = await db
      .prepare(
        'SELECT id, name, birth_date AS birthDate, relationship, notes FROM persons LIMIT 1',
      )
      .first<Person>();
    if (!person) return error('No hay datos para respaldar', 404);
    const [appointments, medications, tasks] = await Promise.all([
      db
        .prepare(
          'SELECT id, person_id AS personId, specialty, doctor, date, time, place, bring, notes, status FROM appointments WHERE person_id = ? ORDER BY date, time',
        )
        .bind(person.id)
        .all<Appointment>(),
      db
        .prepare(
          'SELECT id, person_id AS personId, name, dose, frequency, doctor, notes, active FROM medications WHERE person_id = ? ORDER BY name',
        )
        .bind(person.id)
        .all<Omit<Medication, 'active'> & { active: number }>(),
      db
        .prepare(
          'SELECT id, person_id AS personId, title, due_date AS dueDate, priority, status, notes FROM tasks WHERE person_id = ? ORDER BY due_date',
        )
        .bind(person.id)
        .all<MedicalTask>(),
    ]);
    const backup: BackupData = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      person,
      appointments: appointments.results,
      medications: medications.results.map((item) => ({
        ...item,
        active: Boolean(item.active),
      })),
      tasks: tasks.results,
    };
    return new NextResponse(JSON.stringify(backup, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="cerca-respaldo-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch {
    return error('No se pudo crear el respaldo', 500);
  }
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 5_000_000)
      return error('El archivo supera el límite de 5 MB', 400);
    const parsed = backupSchema.safeParse(await request.json());
    if (!parsed.success)
      return error(
        'El respaldo no es válido o no es compatible',
        400,
        fieldErrors(parsed.error),
      );
    const backup = parsed.data;
    const db = getD1();
    await db.batch([
      db.prepare('DELETE FROM appointments'),
      db.prepare('DELETE FROM medications'),
      db.prepare('DELETE FROM tasks'),
      db.prepare('DELETE FROM persons'),
      db
        .prepare(
          'INSERT INTO persons (id, name, birth_date, relationship, notes) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(
          backup.person.id,
          backup.person.name,
          backup.person.birthDate,
          backup.person.relationship,
          backup.person.notes,
        ),
      ...backup.appointments.map((item) =>
        db
          .prepare(
            'INSERT INTO appointments (id, person_id, specialty, doctor, date, time, place, bring, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            item.id,
            item.personId,
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
            'INSERT INTO medications (id, person_id, name, dose, frequency, doctor, notes, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            item.id,
            item.personId,
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
            'INSERT INTO tasks (id, person_id, title, due_date, priority, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
          )
          .bind(
            item.id,
            item.personId,
            item.title,
            item.dueDate,
            item.priority,
            item.status,
            item.notes,
          ),
      ),
    ]);
    await db.prepare('PRAGMA optimize').run();
    return NextResponse.json({ ok: true });
  } catch {
    return error(
      'No se pudo restaurar el respaldo; tus datos actuales no fueron modificados',
      500,
    );
  }
}
