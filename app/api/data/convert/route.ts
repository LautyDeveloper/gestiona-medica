import { z } from 'zod';
import { getD1 } from '@/db';
import type { Appointment, Medication } from '@/lib/models';
import {
  appointmentSchema,
  fieldErrors,
  medicationSchema,
} from '@/lib/validation';
import {
  authError,
  requireMembership,
  requireSameOrigin,
} from '@/lib/server-auth';

const conversionSchema = z.object({
  sourceEntity: z.enum(['order', 'prescription']),
  sourceId: z.uuid(),
  personId: z.uuid(),
  careGroupId: z.uuid(),
  version: z.number().int().positive(),
  data: z.unknown(),
});

function error(message: string, status: number, details?: unknown) {
  return Response.json({ error: message, details }, { status });
}

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
    const body = conversionSchema.safeParse(await request.json());
    if (!body.success)
      return error('La conversión solicitada no es válida', 400);
    await requireMembership(request, body.data.careGroupId);
    const db = getD1();
    const person = await db
      .prepare(
        'SELECT id FROM persons WHERE id = ? AND care_group_id = ? AND archived = 0',
      )
      .bind(body.data.personId, body.data.careGroupId)
      .first();
    if (!person) return error('La persona no existe o está archivada', 404);

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
    if (!source) return error('El documento no existe para esta persona', 404);
    if (source.status === 'used')
      return error('Este documento ya fue utilizado', 409);
    if (source.expirationDate < todayInArgentina())
      return error('El documento está vencido', 409);
    if (source.version !== body.data.version)
      return error(
        'El documento cambió en otro dispositivo. Recargá e intentá nuevamente.',
        409,
      );

    const targetId = crypto.randomUUID();
    const usedAt = new Date().toISOString();
    const today = todayInArgentina();
    if (isOrder) {
      const parsed = appointmentSchema.safeParse(body.data.data);
      if (!parsed.success)
        return error(
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
        return error('La orden ya no está disponible para convertir', 409);
    } else {
      const parsed = medicationSchema.safeParse(body.data.data);
      if (!parsed.success)
        return error(
          'Revisá los campos marcados',
          400,
          fieldErrors(parsed.error),
        );
      const item = parsed.data as Omit<Medication, 'id' | 'personId'>;
      const results = await db.batch([
        db
          .prepare(
            `INSERT INTO medications (id, person_id, name, dose, frequency, doctor, notes, active, version)
             SELECT ?, ?, ?, ?, ?, ?, ?, ?, 1
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
            body.data.sourceId,
            body.data.personId,
            today,
            body.data.version,
          ),
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
      ]);
      if (!results[0].meta.changes || !results[1].meta.changes)
        return error('La receta ya no está disponible para convertir', 409);
    }
    return Response.json({ id: targetId }, { status: 201 });
  } catch (caught) {
    return caught instanceof Error && 'status' in caught
      ? authError(caught)
      : error('No se pudo convertir el documento', 500);
  }
}
