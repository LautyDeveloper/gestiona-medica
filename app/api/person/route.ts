import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getD1 } from '@/db';
import type { PeopleData, PersonSummary } from '@/lib/models';
import { fieldErrors, personSchema } from '@/lib/validation';
import { authError, requireMembership } from '@/lib/server-auth';

function error(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function GET(request: Request) {
  try {
    const careGroupId =
      new URL(request.url).searchParams.get('careGroupId') || '';
    await requireMembership(request, careGroupId);
    const result = await getD1()
      .prepare(`
      SELECT p.id, p.care_group_id AS careGroupId, p.name, p.birth_date AS birthDate, p.relationship, p.notes, p.archived, p.version,
        (SELECT COUNT(*) FROM appointments a WHERE a.person_id = p.id) AS appointmentCount,
        (SELECT COUNT(*) FROM medical_orders o WHERE o.person_id = p.id) AS orderCount,
        (SELECT COUNT(*) FROM medications m WHERE m.person_id = p.id) AS medicationCount,
        (SELECT COUNT(*) FROM prescriptions r WHERE r.person_id = p.id) AS prescriptionCount,
        (SELECT COUNT(*) FROM tasks t WHERE t.person_id = p.id) AS taskCount
      FROM persons p
      WHERE p.care_group_id = ?
      ORDER BY p.archived, p.name COLLATE NOCASE
    `)
      .bind(careGroupId)
      .all<Omit<PersonSummary, 'archived'> & { archived: number }>();
    return NextResponse.json({
      persons: result.results.map((person) => ({
        ...person,
        archived: Boolean(person.archived),
        appointmentCount: Number(person.appointmentCount),
        orderCount: Number(person.orderCount),
        medicationCount: Number(person.medicationCount),
        prescriptionCount: Number(person.prescriptionCount),
        taskCount: Number(person.taskCount),
      })),
    } satisfies PeopleData);
  } catch (caught) {
    return caught instanceof Error && 'status' in caught
      ? authError(caught)
      : error('No se pudieron cargar las personas', 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      careGroupId?: string;
      data?: unknown;
    };
    await requireMembership(request, body.careGroupId || '');
    const parsed = personSchema.safeParse(body.data);
    if (!parsed.success)
      return error(
        'Revisá los campos marcados',
        400,
        fieldErrors(parsed.error),
      );
    const id = crypto.randomUUID();
    await getD1()
      .prepare(
        'INSERT INTO persons (id, care_group_id, name, birth_date, relationship, notes, archived, version) VALUES (?, ?, ?, ?, ?, ?, 0, 1)',
      )
      .bind(
        id,
        body.careGroupId,
        parsed.data.name,
        parsed.data.birthDate,
        parsed.data.relationship,
        parsed.data.notes,
      )
      .run();
    return NextResponse.json({ id }, { status: 201 });
  } catch (caught) {
    return caught instanceof Error && 'status' in caught
      ? authError(caught)
      : error('No se pudo guardar el perfil', 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: unknown;
      careGroupId?: string;
      version?: number;
      data?: unknown;
    };
    await requireMembership(request, body.careGroupId || '');
    const id = z.uuid().safeParse(body.id);
    const parsed = personSchema.safeParse(body.data);
    if (!id.success) return error('Identificador de persona inválido', 400);
    if (!parsed.success)
      return error(
        'Revisá los campos marcados',
        400,
        fieldErrors(parsed.error),
      );
    const result = await getD1()
      .prepare(
        'UPDATE persons SET name = ?, birth_date = ?, relationship = ?, notes = ?, version = version + 1 WHERE id = ? AND care_group_id = ? AND version = ?',
      )
      .bind(
        parsed.data.name,
        parsed.data.birthDate,
        parsed.data.relationship,
        parsed.data.notes,
        id.data,
        body.careGroupId,
        body.version,
      )
      .run();
    if (!result.meta.changes)
      return error(
        'El perfil cambió en otro dispositivo. Recargá e intentá nuevamente.',
        409,
      );
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return caught instanceof Error && 'status' in caught
      ? authError(caught)
      : error('No se pudo actualizar el perfil', 500);
  }
}
