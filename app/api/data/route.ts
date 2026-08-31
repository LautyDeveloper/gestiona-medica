import { z } from 'zod';
import { getD1 } from '@/db';
import type {
  AppData,
  Appointment,
  Entity,
  MedicalOrder,
  MedicalTask,
  Medication,
  Person,
  Prescription,
} from '@/lib/models';
import { entitySchema, fieldErrors, recordSchemas } from '@/lib/validation';
import { authError, requireMembership } from '@/lib/server-auth';

const tables: Record<Entity, string> = {
  appointment: 'appointments',
  order: 'medical_orders',
  medication: 'medications',
  prescription: 'prescriptions',
  task: 'tasks',
};

function apiError(message: string, status: number, details?: unknown) {
  return Response.json({ error: message, details }, { status });
}

type ActivePersonResult =
  | { ok: false; error: Response }
  | { ok: true; person: Person };

async function activePerson(
  personId: unknown,
  careGroupId: string,
): Promise<ActivePersonResult> {
  const id = z.uuid().safeParse(personId);
  if (!id.success)
    return {
      ok: false,
      error: apiError('Identificador de persona inválido', 400),
    };
  const raw = await getD1()
    .prepare(
      'SELECT id, care_group_id AS careGroupId, name, birth_date AS birthDate, relationship, notes, archived, version FROM persons WHERE id = ? AND care_group_id = ?',
    )
    .bind(id.data, careGroupId)
    .first<Omit<Person, 'archived'> & { archived: number }>();
  if (!raw) return { ok: false, error: apiError('La persona no existe', 404) };
  if (raw.archived)
    return { ok: false, error: apiError('La persona está archivada', 409) };
  return {
    ok: true,
    person: { ...raw, archived: false } satisfies Person,
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const careGroupId =
      new URL(request.url).searchParams.get('careGroupId') || '';
    await requireMembership(request, careGroupId);
    const personResult = await activePerson(
      new URL(request.url).searchParams.get('personId'),
      careGroupId,
    );
    if (!personResult.ok) return personResult.error;
    const person = personResult.person;
    const db = getD1();
    const [appointments, orders, medications, prescriptions, tasks] =
      await Promise.all([
        db
          .prepare(
            'SELECT id, person_id AS personId, specialty, doctor, date, time, place, bring, notes, status, version FROM appointments WHERE person_id = ? ORDER BY date, time',
          )
          .bind(person.id)
          .all<Appointment>(),
        db
          .prepare(
            "SELECT id, person_id AS personId, specialty, reason, requested_by AS requestedBy, issue_date AS issueDate, expiration_date AS expirationDate, notes, status, appointment_id AS appointmentId, used_at AS usedAt, version FROM medical_orders WHERE person_id = ? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, expiration_date, issue_date",
          )
          .bind(person.id)
          .all<MedicalOrder>(),
        db
          .prepare(
            'SELECT id, person_id AS personId, name, dose, frequency, doctor, notes, active, version FROM medications WHERE person_id = ? ORDER BY active DESC, name',
          )
          .bind(person.id)
          .all<Omit<Medication, 'active'> & { active: number }>(),
        db
          .prepare(
            "SELECT id, person_id AS personId, medication_name AS medicationName, presentation, dose, frequency, duration, prescribed_by AS prescribedBy, issue_date AS issueDate, expiration_date AS expirationDate, notes, status, medication_id AS medicationId, used_at AS usedAt, version FROM prescriptions WHERE person_id = ? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, expiration_date, issue_date",
          )
          .bind(person.id)
          .all<Prescription>(),
        db
          .prepare(
            "SELECT id, person_id AS personId, title, due_date AS dueDate, priority, status, notes, version FROM tasks WHERE person_id = ? ORDER BY CASE status WHEN 'Pendiente' THEN 0 ELSE 1 END, CASE WHEN due_date = '' THEN 1 ELSE 0 END, due_date",
          )
          .bind(person.id)
          .all<MedicalTask>(),
      ]);
    return Response.json({
      person,
      appointments: appointments.results,
      orders: orders.results,
      medications: medications.results.map((item) => ({
        ...item,
        active: Boolean(item.active),
      })),
      prescriptions: prescriptions.results,
      tasks: tasks.results,
    } satisfies AppData);
  } catch (caught) {
    return caught instanceof Error && 'status' in caught
      ? authError(caught)
      : apiError('No se pudieron cargar los datos', 500);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      entity?: unknown;
      personId?: unknown;
      careGroupId?: string;
      data?: unknown;
    };
    const entityResult = entitySchema.safeParse(body.entity);
    if (!entityResult.success) return apiError('Entidad inválida', 400);
    await requireMembership(request, body.careGroupId || '');
    const personResult = await activePerson(
      body.personId,
      body.careGroupId || '',
    );
    if (!personResult.ok) return personResult.error;
    const entity = entityResult.data;
    const parsed = recordSchemas[entity].safeParse(body.data);
    if (!parsed.success)
      return apiError(
        'Revisá los campos marcados',
        400,
        fieldErrors(parsed.error),
      );
    const db = getD1();
    const id = crypto.randomUUID();
    const data = parsed.data;
    let changes = 0;
    if (entity === 'appointment') {
      const item = data as Omit<Appointment, 'id' | 'personId'>;
      const result = await db
        .prepare(
          'INSERT INTO appointments (id, person_id, specialty, doctor, date, time, place, bring, notes, status, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
        )
        .bind(
          id,
          personResult.person.id,
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
      changes = result.meta.changes;
    } else if (entity === 'order') {
      const item = data as Omit<
        MedicalOrder,
        'id' | 'personId' | 'status' | 'appointmentId' | 'usedAt'
      >;
      const result = await db
        .prepare(
          "INSERT INTO medical_orders (id, person_id, specialty, reason, requested_by, issue_date, expiration_date, notes, status, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1)",
        )
        .bind(
          id,
          personResult.person.id,
          item.specialty,
          item.reason,
          item.requestedBy,
          item.issueDate,
          item.expirationDate,
          item.notes,
        )
        .run();
      changes = result.meta.changes;
    } else if (entity === 'medication') {
      const item = data as Omit<Medication, 'id' | 'personId'>;
      const result = await db
        .prepare(
          'INSERT INTO medications (id, person_id, name, dose, frequency, doctor, notes, active, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
        )
        .bind(
          id,
          personResult.person.id,
          item.name,
          item.dose,
          item.frequency,
          item.doctor,
          item.notes,
          item.active ? 1 : 0,
        )
        .run();
      changes = result.meta.changes;
    } else if (entity === 'prescription') {
      const item = data as Omit<
        Prescription,
        'id' | 'personId' | 'status' | 'medicationId' | 'usedAt'
      >;
      const result = await db
        .prepare(
          "INSERT INTO prescriptions (id, person_id, medication_name, presentation, dose, frequency, duration, prescribed_by, issue_date, expiration_date, notes, status, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1)",
        )
        .bind(
          id,
          personResult.person.id,
          item.medicationName,
          item.presentation,
          item.dose,
          item.frequency,
          item.duration,
          item.prescribedBy,
          item.issueDate,
          item.expirationDate,
          item.notes,
        )
        .run();
      changes = result.meta.changes;
    } else {
      const item = data as Omit<MedicalTask, 'id' | 'personId'>;
      const result = await db
        .prepare(
          'INSERT INTO tasks (id, person_id, title, due_date, priority, status, notes, version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
        )
        .bind(
          id,
          personResult.person.id,
          item.title,
          item.dueDate,
          item.priority,
          item.status,
          item.notes,
        )
        .run();
      changes = result.meta.changes;
    }
    if (!changes)
      return apiError(
        'Este registro cambió en otro dispositivo. Recargá e intentá nuevamente.',
        409,
      );
    return Response.json({ id }, { status: 201 });
  } catch (caught) {
    return caught instanceof Error && 'status' in caught
      ? authError(caught)
      : apiError('No se pudo guardar el registro', 500);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      entity?: unknown;
      id?: unknown;
      personId?: unknown;
      careGroupId?: string;
      data?: unknown;
    };
    const entityResult = entitySchema.safeParse(body.entity);
    const idResult = z.uuid().safeParse(body.id);
    if (!entityResult.success || !idResult.success)
      return apiError('Solicitud inválida', 400);
    await requireMembership(request, body.careGroupId || '');
    const personResult = await activePerson(
      body.personId,
      body.careGroupId || '',
    );
    if (!personResult.ok) return personResult.error;
    const entity = entityResult.data;
    const parsed = recordSchemas[entity].safeParse(body.data);
    if (!parsed.success)
      return apiError(
        'Revisá los campos marcados',
        400,
        fieldErrors(parsed.error),
      );
    const db = getD1();
    const owned = await db
      .prepare(
        `SELECT id FROM ${tables[entity]} WHERE id = ? AND person_id = ?`,
      )
      .bind(idResult.data, personResult.person.id)
      .first();
    if (!owned) return apiError('El registro no existe para esta persona', 404);
    const data = parsed.data;
    const version = z
      .number()
      .int()
      .positive()
      .safeParse((body.data as { version?: unknown } | null)?.version);
    if (!version.success) return apiError('Versión de registro inválida', 400);
    let changes = 0;
    if (entity === 'appointment') {
      const item = data as Omit<Appointment, 'id' | 'personId'>;
      const result = await db
        .prepare(
          'UPDATE appointments SET specialty = ?, doctor = ?, date = ?, time = ?, place = ?, bring = ?, notes = ?, status = ?, version = version + 1 WHERE id = ? AND person_id = ? AND version = ?',
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
          idResult.data,
          personResult.person.id,
          version.data,
        )
        .run();
      changes = result.meta.changes;
    } else if (entity === 'order') {
      const item = data as Omit<
        MedicalOrder,
        'id' | 'personId' | 'status' | 'appointmentId' | 'usedAt'
      >;
      const result = await db
        .prepare(
          'UPDATE medical_orders SET specialty = ?, reason = ?, requested_by = ?, issue_date = ?, expiration_date = ?, notes = ?, version = version + 1 WHERE id = ? AND person_id = ? AND version = ?',
        )
        .bind(
          item.specialty,
          item.reason,
          item.requestedBy,
          item.issueDate,
          item.expirationDate,
          item.notes,
          idResult.data,
          personResult.person.id,
          version.data,
        )
        .run();
      changes = result.meta.changes;
    } else if (entity === 'medication') {
      const item = data as Omit<Medication, 'id' | 'personId'>;
      const result = await db
        .prepare(
          'UPDATE medications SET name = ?, dose = ?, frequency = ?, doctor = ?, notes = ?, active = ?, version = version + 1 WHERE id = ? AND person_id = ? AND version = ?',
        )
        .bind(
          item.name,
          item.dose,
          item.frequency,
          item.doctor,
          item.notes,
          item.active ? 1 : 0,
          idResult.data,
          personResult.person.id,
          version.data,
        )
        .run();
      changes = result.meta.changes;
    } else if (entity === 'prescription') {
      const item = data as Omit<
        Prescription,
        'id' | 'personId' | 'status' | 'medicationId' | 'usedAt'
      >;
      const result = await db
        .prepare(
          'UPDATE prescriptions SET medication_name = ?, presentation = ?, dose = ?, frequency = ?, duration = ?, prescribed_by = ?, issue_date = ?, expiration_date = ?, notes = ?, version = version + 1 WHERE id = ? AND person_id = ? AND version = ?',
        )
        .bind(
          item.medicationName,
          item.presentation,
          item.dose,
          item.frequency,
          item.duration,
          item.prescribedBy,
          item.issueDate,
          item.expirationDate,
          item.notes,
          idResult.data,
          personResult.person.id,
          version.data,
        )
        .run();
      changes = result.meta.changes;
    } else {
      const item = data as Omit<MedicalTask, 'id' | 'personId'>;
      const result = await db
        .prepare(
          'UPDATE tasks SET title = ?, due_date = ?, priority = ?, status = ?, notes = ?, version = version + 1 WHERE id = ? AND person_id = ? AND version = ?',
        )
        .bind(
          item.title,
          item.dueDate,
          item.priority,
          item.status,
          item.notes,
          idResult.data,
          personResult.person.id,
          version.data,
        )
        .run();
      changes = result.meta.changes;
    }
    if (!changes)
      return apiError(
        'Este registro cambió en otro dispositivo. Recargá e intentá nuevamente.',
        409,
      );
    return Response.json({ ok: true });
  } catch (caught) {
    return caught instanceof Error && 'status' in caught
      ? authError(caught)
      : apiError('No se pudo actualizar el registro', 500);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const entityResult = entitySchema.safeParse(url.searchParams.get('entity'));
    const idResult = z.uuid().safeParse(url.searchParams.get('id'));
    if (!entityResult.success || !idResult.success)
      return apiError('Solicitud inválida', 400);
    const careGroupId = url.searchParams.get('careGroupId') || '';
    await requireMembership(request, careGroupId);
    const personResult = await activePerson(
      url.searchParams.get('personId'),
      careGroupId,
    );
    if (!personResult.ok) return personResult.error;
    const result = await getD1()
      .prepare(
        `DELETE FROM ${tables[entityResult.data]} WHERE id = ? AND person_id = ?`,
      )
      .bind(idResult.data, personResult.person.id)
      .run();
    if (!result.meta.changes)
      return apiError('El registro no existe para esta persona', 404);
    return Response.json({ ok: true });
  } catch (caught) {
    return caught instanceof Error && 'status' in caught
      ? authError(caught)
      : apiError('No se pudo eliminar el registro', 500);
  }
}
