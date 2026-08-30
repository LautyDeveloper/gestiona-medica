import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { fieldErrors, personSchema } from '@/lib/validation';

function error(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
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
    const db = getD1();
    if (await db.prepare('SELECT id FROM persons LIMIT 1').first())
      return error('Ya existe una persona configurada', 409);
    const id = crypto.randomUUID();
    await db
      .prepare(
        'INSERT INTO persons (id, name, birth_date, relationship, notes) VALUES (?, ?, ?, ?, ?)',
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
    const parsed = personSchema.safeParse(await request.json());
    if (!parsed.success)
      return error(
        'Revisá los campos marcados',
        400,
        fieldErrors(parsed.error),
      );
    const db = getD1();
    const person = await db
      .prepare('SELECT id FROM persons LIMIT 1')
      .first<{ id: string }>();
    if (!person) return error('No existe una persona configurada', 404);
    await db
      .prepare(
        'UPDATE persons SET name = ?, birth_date = ?, relationship = ?, notes = ? WHERE id = ?',
      )
      .bind(
        parsed.data.name,
        parsed.data.birthDate,
        parsed.data.relationship,
        parsed.data.notes,
        person.id,
      )
      .run();
    return NextResponse.json({ ok: true });
  } catch {
    return error('No se pudo actualizar el perfil', 500);
  }
}
