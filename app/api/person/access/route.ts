import { getD1 } from '@/db';
import { hashPassword } from '@/lib/password';
import {
  authError,
  requireMembership,
  requireSameOrigin,
} from '@/lib/server-auth';
import {
  createPersonAccessSchema,
  deletePersonAccessSchema,
  fieldErrors,
  updatePersonAccessSchema,
} from '@/lib/validation';
import { readJson } from '@/lib/api-response';

function invalid(error: Parameters<typeof fieldErrors>[0]) {
  return Response.json(
    { error: 'Revisá los datos ingresados', details: fieldErrors(error) },
    { status: 400 },
  );
}

async function target(personId: string, careGroupId: string) {
  return getD1()
    .prepare(
      `SELECT p.name, p.archived, pa.user_id AS userId
       FROM persons p LEFT JOIN person_access pa ON pa.person_id = p.id
       WHERE p.id = ? AND p.care_group_id = ?`,
    )
    .bind(personId, careGroupId)
    .first<{ name: string; archived: number; userId: string | null }>();
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = createPersonAccessSchema.safeParse(await readJson(request));
    if (!parsed.success) return invalid(parsed.error);
    await requireMembership(request, parsed.data.careGroupId, 'admin');
    const person = await target(parsed.data.personId, parsed.data.careGroupId);
    if (!person)
      return Response.json({ error: 'La persona no existe' }, { status: 404 });
    if (person.archived)
      return Response.json(
        { error: 'Restaurá el perfil antes de habilitar su acceso' },
        { status: 409 },
      );
    if (person.userId)
      return Response.json(
        { error: 'La persona ya tiene un acceso configurado' },
        { status: 409 },
      );
    const db = getD1();
    const duplicate = await db
      .prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE')
      .bind(parsed.data.username)
      .first();
    if (duplicate)
      return Response.json(
        { error: 'Ese nombre de usuario ya está en uso' },
        { status: 409 },
      );
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(
          `INSERT INTO users (id, username, display_name, password_hash, user_type, failed_login_count, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, 'elder', 0, ?, ?)`,
        )
        .bind(
          userId,
          parsed.data.username,
          person.name,
          await hashPassword(parsed.data.password),
          now,
          now,
        ),
      db
        .prepare(
          `INSERT INTO memberships (id, user_id, care_group_id, role, created_at)
         VALUES (?, ?, ?, 'member', ?)`,
        )
        .bind(crypto.randomUUID(), userId, parsed.data.careGroupId, now),
      db
        .prepare(
          'INSERT INTO person_access (person_id, user_id, created_at) VALUES (?, ?, ?)',
        )
        .bind(parsed.data.personId, userId, now),
    ]);
    return Response.json({ id: userId }, { status: 201 });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = updatePersonAccessSchema.safeParse(await readJson(request));
    if (!parsed.success) return invalid(parsed.error);
    await requireMembership(request, parsed.data.careGroupId, 'admin');
    const person = await target(parsed.data.personId, parsed.data.careGroupId);
    if (!person?.userId)
      return Response.json(
        { error: 'La persona no tiene un acceso configurado' },
        { status: 404 },
      );
    const db = getD1();
    if (parsed.data.username) {
      const duplicate = await db
        .prepare(
          'SELECT 1 FROM users WHERE username = ? COLLATE NOCASE AND id <> ?',
        )
        .bind(parsed.data.username, person.userId)
        .first();
      if (duplicate)
        return Response.json(
          { error: 'Ese nombre de usuario ya está en uso' },
          { status: 409 },
        );
    }
    const statements = [];
    if (parsed.data.username)
      statements.push(
        db
          .prepare('UPDATE users SET username = ? WHERE id = ?')
          .bind(parsed.data.username, person.userId),
      );
    if (parsed.data.password) {
      statements.push(
        db
          .prepare(
            'UPDATE users SET password_hash = ?, failed_login_count = 0, locked_until = NULL WHERE id = ?',
          )
          .bind(await hashPassword(parsed.data.password), person.userId),
        db
          .prepare(
            'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
          )
          .bind(new Date().toISOString(), person.userId),
      );
    }
    await db.batch(statements);
    return Response.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = deletePersonAccessSchema.safeParse(await readJson(request));
    if (!parsed.success) return invalid(parsed.error);
    await requireMembership(request, parsed.data.careGroupId, 'admin');
    const person = await target(parsed.data.personId, parsed.data.careGroupId);
    if (!person?.userId)
      return Response.json(
        { error: 'La persona no tiene un acceso configurado' },
        { status: 404 },
      );
    const db = getD1();
    await db.batch([
      db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(person.userId),
      db
        .prepare('DELETE FROM memberships WHERE user_id = ?')
        .bind(person.userId),
      db
        .prepare('DELETE FROM person_access WHERE user_id = ?')
        .bind(person.userId),
      db
        .prepare("DELETE FROM users WHERE id = ? AND user_type = 'elder'")
        .bind(person.userId),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}
