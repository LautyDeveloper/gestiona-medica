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
import { requireMembership, requireSameOrigin } from '@/lib/server-auth';
import { handleApiError, jsonError, readJson } from '@/lib/api-response';
import { toStockMilli } from '@/lib/medications';
import {
  hydrateMedications,
  MEDICATION_SELECT,
  type RawMedication,
  type RawScheduleTime,
} from '@/lib/server-medications';

const tables: Record<Entity, string> = {
  appointment: 'appointments',
  order: 'medical_orders',
  medication: 'medications',
  prescription: 'prescriptions',
  task: 'tasks',
};

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
      error: jsonError('Identificador de persona inválido', 400),
    };
  const raw = await getD1()
    .prepare(
      'SELECT id, care_group_id AS careGroupId, name, birth_date AS birthDate, relationship, notes, archived, version FROM persons WHERE id = ? AND care_group_id = ?',
    )
    .bind(id.data, careGroupId)
    .first<Omit<Person, 'archived'> & { archived: number }>();
  if (!raw) return { ok: false, error: jsonError('La persona no existe', 404) };
  if (raw.archived)
    return { ok: false, error: jsonError('La persona está archivada', 409) };
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
    const [
      appointments,
      orders,
      medications,
      prescriptions,
      tasks,
      medicationTimes,
    ] = await Promise.all([
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
          `SELECT ${MEDICATION_SELECT} FROM medications
             WHERE person_id = ? ORDER BY active DESC, name`,
        )
        .bind(person.id)
        .all<RawMedication>(),
      db
        .prepare(
          "SELECT id, person_id AS personId, medication_name AS medicationName, presentation, dose, frequency, duration, prescribed_by AS prescribedBy, issue_date AS issueDate, expiration_date AS expirationDate, notes, status, medication_id AS medicationId, used_at AS usedAt, version FROM prescriptions WHERE person_id = ? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, expiration_date, issue_date",
        )
        .bind(person.id)
        .all<Prescription>(),
      db
        .prepare(
          "SELECT id, person_id AS personId, title, due_date AS dueDate, priority, status, notes, visible_to_elder AS visibleToElder, version FROM tasks WHERE person_id = ? ORDER BY CASE status WHEN 'Pendiente' THEN 0 ELSE 1 END, CASE WHEN due_date = '' THEN 1 ELSE 0 END, due_date",
        )
        .bind(person.id)
        .all<MedicalTask>(),
      db
        .prepare(
          `SELECT medication_id AS medicationId, local_time AS localTime
             FROM medication_schedule_times
             WHERE medication_id IN (SELECT id FROM medications WHERE person_id = ?)
             ORDER BY medication_id, position, local_time`,
        )
        .bind(person.id)
        .all<RawScheduleTime>(),
    ]);
    return Response.json({
      person,
      appointments: appointments.results,
      orders: orders.results,
      medications: hydrateMedications(
        medications.results,
        medicationTimes.results,
      ),
      prescriptions: prescriptions.results,
      tasks: tasks.results.map((item) => ({
        ...item,
        visibleToElder: Boolean(item.visibleToElder),
      })),
    } satisfies AppData);
  } catch (caught) {
    return handleApiError(caught, 'No se pudieron cargar los datos');
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireSameOrigin(request);
    const body = (await readJson(request)) as {
      entity?: unknown;
      personId?: unknown;
      careGroupId?: string;
      data?: unknown;
    };
    const entityResult = entitySchema.safeParse(body.entity);
    if (!entityResult.success) return jsonError('Entidad inválida', 400);
    await requireMembership(request, body.careGroupId || '');
    const personResult = await activePerson(
      body.personId,
      body.careGroupId || '',
    );
    if (!personResult.ok) return personResult.error;
    const entity = entityResult.data;
    const parsed = recordSchemas[entity].safeParse(body.data);
    if (!parsed.success)
      return jsonError(
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
      const statements = [
        db
          .prepare(
            `INSERT INTO medications (
               id, person_id, name, dose, frequency, doctor, notes, active,
               schedule_type, start_date, end_date, interval_minutes,
               interval_anchor_at, presentation, stock_unit,
               units_per_intake_milli, stock_quantity_milli,
               reorder_threshold_milli, stock_cycle, version
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`,
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
          ),
        ...item.scheduleTimes.map((time, position) =>
          db
            .prepare(
              'INSERT INTO medication_schedule_times (id, medication_id, local_time, position) VALUES (?, ?, ?, ?)',
            )
            .bind(crypto.randomUUID(), id, time, position),
        ),
        ...(item.stockQuantity
          ? [
              db
                .prepare(
                  `INSERT INTO medication_stock_movements
                     (id, medication_id, intake_id, delta_milli, reason, recorded_by_user_id, recorded_at)
                   VALUES (?, ?, NULL, ?, 'initial', NULL, ?)`,
                )
                .bind(
                  crypto.randomUUID(),
                  id,
                  toStockMilli(item.stockQuantity),
                  new Date().toISOString(),
                ),
            ]
          : []),
      ];
      const results = await db.batch(statements);
      changes = results[0]?.meta.changes || 0;
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
          'INSERT INTO tasks (id, person_id, title, due_date, priority, status, notes, visible_to_elder, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
        )
        .bind(
          id,
          personResult.person.id,
          item.title,
          item.dueDate,
          item.priority,
          item.status,
          item.notes,
          item.visibleToElder ? 1 : 0,
        )
        .run();
      changes = result.meta.changes;
    }
    if (!changes)
      return jsonError(
        'Este registro cambió en otro dispositivo. Recargá e intentá nuevamente.',
        409,
      );
    return Response.json({ id }, { status: 201 });
  } catch (caught) {
    return handleApiError(caught, 'No se pudo guardar el registro');
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    requireSameOrigin(request);
    const body = (await readJson(request)) as {
      entity?: unknown;
      id?: unknown;
      personId?: unknown;
      careGroupId?: string;
      data?: unknown;
    };
    const entityResult = entitySchema.safeParse(body.entity);
    const idResult = z.uuid().safeParse(body.id);
    if (!entityResult.success || !idResult.success)
      return jsonError('Solicitud inválida', 400);
    await requireMembership(request, body.careGroupId || '');
    const personResult = await activePerson(
      body.personId,
      body.careGroupId || '',
    );
    if (!personResult.ok) return personResult.error;
    const entity = entityResult.data;
    const parsed = recordSchemas[entity].safeParse(body.data);
    if (!parsed.success)
      return jsonError(
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
    if (!owned)
      return jsonError('El registro no existe para esta persona', 404);
    const data = parsed.data;
    const version = z
      .number()
      .int()
      .positive()
      .safeParse((body.data as { version?: unknown } | null)?.version);
    if (!version.success) return jsonError('Versión de registro inválida', 400);
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
      const results = await db.batch([
        db
          .prepare(
            `UPDATE medications SET name = ?, dose = ?, frequency = ?,
               doctor = ?, notes = ?, active = ?, schedule_type = ?,
               start_date = ?, end_date = ?, interval_minutes = ?,
               interval_anchor_at = ?, presentation = ?, stock_unit = ?,
               units_per_intake_milli = ?, stock_quantity_milli = ?,
               reorder_threshold_milli = ?, stock_cycle = ?, version = version + 1
             WHERE id = ? AND person_id = ? AND version = ?`,
          )
          .bind(
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
            item.stockCycle || 1,
            idResult.data,
            personResult.person.id,
            version.data,
          ),
        db
          .prepare(
            'DELETE FROM medication_schedule_times WHERE medication_id = ?',
          )
          .bind(idResult.data),
        ...item.scheduleTimes.map((time, position) =>
          db
            .prepare(
              'INSERT INTO medication_schedule_times (id, medication_id, local_time, position) VALUES (?, ?, ?, ?)',
            )
            .bind(crypto.randomUUID(), idResult.data, time, position),
        ),
      ]);
      changes = results[0]?.meta.changes || 0;
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
          'UPDATE tasks SET title = ?, due_date = ?, priority = ?, status = ?, notes = ?, visible_to_elder = ?, version = version + 1 WHERE id = ? AND person_id = ? AND version = ?',
        )
        .bind(
          item.title,
          item.dueDate,
          item.priority,
          item.status,
          item.notes,
          item.visibleToElder ? 1 : 0,
          idResult.data,
          personResult.person.id,
          version.data,
        )
        .run();
      changes = result.meta.changes;
    }
    if (!changes)
      return jsonError(
        'Este registro cambió en otro dispositivo. Recargá e intentá nuevamente.',
        409,
      );
    return Response.json({ ok: true });
  } catch (caught) {
    return handleApiError(caught, 'No se pudo actualizar el registro');
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    requireSameOrigin(request);
    const url = new URL(request.url);
    const entityResult = entitySchema.safeParse(url.searchParams.get('entity'));
    const idResult = z.uuid().safeParse(url.searchParams.get('id'));
    if (!entityResult.success || !idResult.success)
      return jsonError('Solicitud inválida', 400);
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
      return jsonError('El registro no existe para esta persona', 404);
    return Response.json({ ok: true });
  } catch (caught) {
    return handleApiError(caught, 'No se pudo eliminar el registro');
  }
}
