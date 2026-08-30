import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import type {
  AppData,
  Appointment,
  Entity,
  MedicalTask,
  Medication,
  Person,
} from '@/lib/models';
import { entitySchema, fieldErrors, recordSchemas } from '@/lib/validation';

const tables: Record<Entity, string> = {
  appointment: 'appointments',
  medication: 'medications',
  task: 'tasks',
};

function apiError(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

async function currentPerson() {
  return getD1()
    .prepare(
      'SELECT id, name, birth_date AS birthDate, relationship, notes FROM persons LIMIT 1',
    )
    .first<Person>();
}

export async function GET() {
  try {
    const db = getD1();
    const person = await currentPerson();
    if (!person)
      return NextResponse.json({
        person: null,
        appointments: [],
        medications: [],
        tasks: [],
      } satisfies AppData);
    const [appointments, medications, tasks] = await Promise.all([
      db
        .prepare(
          'SELECT id, person_id AS personId, specialty, doctor, date, time, place, bring, notes, status FROM appointments WHERE person_id = ? ORDER BY date, time',
        )
        .bind(person.id)
        .all(),
      db
        .prepare(
          'SELECT id, person_id AS personId, name, dose, frequency, doctor, notes, active FROM medications WHERE person_id = ? ORDER BY active DESC, name',
        )
        .bind(person.id)
        .all(),
      db
        .prepare(
          "SELECT id, person_id AS personId, title, due_date AS dueDate, priority, status, notes FROM tasks WHERE person_id = ? ORDER BY CASE status WHEN 'Pendiente' THEN 0 ELSE 1 END, CASE WHEN due_date = '' THEN 1 ELSE 0 END, due_date",
        )
        .bind(person.id)
        .all(),
    ]);
    return NextResponse.json({
      person,
      appointments: appointments.results,
      medications: medications.results.map((item) => ({
        ...item,
        active: Boolean(item.active),
      })),
      tasks: tasks.results,
    });
  } catch {
    return apiError('No se pudieron cargar los datos', 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { entity?: unknown; data?: unknown };
    const entityResult = entitySchema.safeParse(body.entity);
    if (!entityResult.success) return apiError('Entidad inválida', 400);
    const entity = entityResult.data;
    const parsed = recordSchemas[entity].safeParse(body.data);
    if (!parsed.success)
      return apiError(
        'Revisá los campos marcados',
        400,
        fieldErrors(parsed.error),
      );
    const person = await currentPerson();
    if (!person) return apiError('Primero configurá a la persona cuidada', 409);
    const db = getD1();
    const id = crypto.randomUUID();
    const data = parsed.data;
    if (entity === 'appointment') {
      const item = data as Omit<Appointment, 'id' | 'personId'>;
      await db
        .prepare(
          'INSERT INTO appointments (id, person_id, specialty, doctor, date, time, place, bring, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          person.id,
          item.specialty,
          item.doctor,
          item.date,
          item.time,
          item.place,
          item.bring,
          item.notes,
          item.status,
        )
        .run();
    } else if (entity === 'medication') {
      const item = data as Omit<Medication, 'id' | 'personId'>;
      await db
        .prepare(
          'INSERT INTO medications (id, person_id, name, dose, frequency, doctor, notes, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          person.id,
          item.name,
          item.dose,
          item.frequency,
          item.doctor,
          item.notes,
          item.active ? 1 : 0,
        )
        .run();
    } else {
      const item = data as Omit<MedicalTask, 'id' | 'personId'>;
      await db
        .prepare(
          'INSERT INTO tasks (id, person_id, title, due_date, priority, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          id,
          person.id,
          item.title,
          item.dueDate,
          item.priority,
          item.status,
          item.notes,
        )
        .run();
    }
    return NextResponse.json({ id }, { status: 201 });
  } catch {
    return apiError('No se pudo guardar el registro', 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      entity?: unknown;
      id?: unknown;
      data?: unknown;
    };
    const entityResult = entitySchema.safeParse(body.entity);
    if (!entityResult.success || typeof body.id !== 'string')
      return apiError('Solicitud inválida', 400);
    const entity = entityResult.data;
    const parsed = recordSchemas[entity].safeParse(body.data);
    if (!parsed.success)
      return apiError(
        'Revisá los campos marcados',
        400,
        fieldErrors(parsed.error),
      );
    const person = await currentPerson();
    if (!person) return apiError('No existe una persona configurada', 409);
    const db = getD1();
    const owned = await db
      .prepare(
        `SELECT id FROM ${tables[entity]} WHERE id = ? AND person_id = ?`,
      )
      .bind(body.id, person.id)
      .first();
    if (!owned) return apiError('El registro no existe', 404);
    const data = parsed.data;
    if (entity === 'appointment') {
      const item = data as Omit<Appointment, 'id' | 'personId'>;
      await db
        .prepare(
          'UPDATE appointments SET specialty = ?, doctor = ?, date = ?, time = ?, place = ?, bring = ?, notes = ?, status = ? WHERE id = ? AND person_id = ?',
        )
        .bind(
          item.specialty,
          item.doctor,
          item.date,
          item.time,
          item.place,
          item.bring,
          item.notes,
          item.status,
          body.id,
          person.id,
        )
        .run();
    } else if (entity === 'medication') {
      const item = data as Omit<Medication, 'id' | 'personId'>;
      await db
        .prepare(
          'UPDATE medications SET name = ?, dose = ?, frequency = ?, doctor = ?, notes = ?, active = ? WHERE id = ? AND person_id = ?',
        )
        .bind(
          item.name,
          item.dose,
          item.frequency,
          item.doctor,
          item.notes,
          item.active ? 1 : 0,
          body.id,
          person.id,
        )
        .run();
    } else {
      const item = data as Omit<MedicalTask, 'id' | 'personId'>;
      await db
        .prepare(
          'UPDATE tasks SET title = ?, due_date = ?, priority = ?, status = ?, notes = ? WHERE id = ? AND person_id = ?',
        )
        .bind(
          item.title,
          item.dueDate,
          item.priority,
          item.status,
          item.notes,
          body.id,
          person.id,
        )
        .run();
    }
    return NextResponse.json({ ok: true });
  } catch {
    return apiError('No se pudo actualizar el registro', 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const entityResult = entitySchema.safeParse(url.searchParams.get('entity'));
    const id = url.searchParams.get('id');
    if (!entityResult.success || !id)
      return apiError('Solicitud inválida', 400);
    const person = await currentPerson();
    if (!person) return apiError('No existe una persona configurada', 409);
    const result = await getD1()
      .prepare(
        `DELETE FROM ${tables[entityResult.data]} WHERE id = ? AND person_id = ?`,
      )
      .bind(id, person.id)
      .run();
    if (!result.meta.changes) return apiError('El registro no existe', 404);
    return NextResponse.json({ ok: true });
  } catch {
    return apiError('No se pudo eliminar el registro', 500);
  }
}
