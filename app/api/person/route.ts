import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getD1 } from '@/db';
import type { PeopleData, PersonSummary } from '@/lib/models';
import { fieldErrors, personSchema } from '@/lib/validation';

function error(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function GET() {
  try {
    const result = await getD1()
      .prepare(`
      SELECT p.id, p.name, p.birth_date AS birthDate, p.relationship, p.notes, p.archived,
        (SELECT COUNT(*) FROM appointments a WHERE a.person_id = p.id) AS appointmentCount,
        (SELECT COUNT(*) FROM medications m WHERE m.person_id = p.id) AS medicationCount,
        (SELECT COUNT(*) FROM tasks t WHERE t.person_id = p.id) AS taskCount
      FROM persons p
      ORDER BY p.archived, p.name COLLATE NOCASE
    `)
      .all<Omit<PersonSummary, 'archived'> & { archived: number }>();
    return NextResponse.json({
      persons: result.results.map((person) => ({
        ...person,
        archived: Boolean(person.archived),
        appointmentCount: Number(person.appointmentCount),
        medicationCount: Number(person.medicationCount),
        taskCount: Number(person.taskCount),
      })),
    } satisfies PeopleData);
  } catch {
    return error('No se pudieron cargar las personas', 500);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = personSchema.safeParse(await request.json());
    if (!parsed.success)
      return error(
        'Revisá los campos marcados',
        400,
        fieldErrors(parsed.error),
      );
    const id = crypto.randomUUID();
    await getD1()
      .prepare(
        'INSERT INTO persons (id, name, birth_date, relationship, notes, archived) VALUES (?, ?, ?, ?, ?, 0)',
      )
      .bind(
        id,
        parsed.data.name,
        parsed.data.birthDate,
        parsed.data.relationship,
        parsed.data.notes,
      )
      .run();
    return NextResponse.json({ id }, { status: 201 });
  } catch {
    return error('No se pudo guardar el perfil', 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: unknown; data?: unknown };
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
        'UPDATE persons SET name = ?, birth_date = ?, relationship = ?, notes = ? WHERE id = ?',
      )
      .bind(
        parsed.data.name,
        parsed.data.birthDate,
        parsed.data.relationship,
        parsed.data.notes,
        id.data,
      )
      .run();
    if (!result.meta.changes) return error('La persona no existe', 404);
    return NextResponse.json({ ok: true });
  } catch {
    return error('No se pudo actualizar el perfil', 500);
  }
}
