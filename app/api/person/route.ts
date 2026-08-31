import { z } from 'zod';
import { getD1 } from '@/db';
import type { PeopleData, PersonSummary } from '@/lib/models';
import {
  createPersonSchema,
  fieldErrors,
  personSchema,
} from '@/lib/validation';
import { hashPassword } from '@/lib/password';
import { authError, requireMembership } from '@/lib/server-auth';

function error(message: string, status: number, details?: unknown) {
  return Response.json({ error: message, details }, { status });
}

export async function GET(request: Request) {
  try {
    const careGroupId =
      new URL(request.url).searchParams.get('careGroupId') || '';
    await requireMembership(request, careGroupId);
    const result = await getD1()
      .prepare(`
      SELECT p.id, p.care_group_id AS careGroupId, p.name, p.birth_date AS birthDate, p.relationship, p.notes, p.archived, p.version,
        u.username AS accessUsername,
        (SELECT COUNT(*) FROM appointments a WHERE a.person_id = p.id) AS appointmentCount,
        (SELECT COUNT(*) FROM medical_orders o WHERE o.person_id = p.id) AS orderCount,
        (SELECT COUNT(*) FROM medications m WHERE m.person_id = p.id) AS medicationCount,
        (SELECT COUNT(*) FROM prescriptions r WHERE r.person_id = p.id) AS prescriptionCount,
        (SELECT COUNT(*) FROM tasks t WHERE t.person_id = p.id) AS taskCount
      FROM persons p
      LEFT JOIN person_access pa ON pa.person_id = p.id
      LEFT JOIN users u ON u.id = pa.user_id
      WHERE p.care_group_id = ?
      ORDER BY p.archived, p.name COLLATE NOCASE
    `)
      .bind(careGroupId)
      .all<Omit<PersonSummary, 'archived'> & { archived: number }>();
    return Response.json({
      persons: result.results.map((person) => {
        const { accessUsername, ...profile } = person as typeof person & {
          accessUsername: string | null;
        };
        return {
          ...profile,
          access: accessUsername ? { username: accessUsername } : null,
          archived: Boolean(person.archived),
          appointmentCount: Number(person.appointmentCount),
          orderCount: Number(person.orderCount),
          medicationCount: Number(person.medicationCount),
          prescriptionCount: Number(person.prescriptionCount),
          taskCount: Number(person.taskCount),
        };
      }),
    } satisfies PeopleData);
  } catch (caught) {
    return caught instanceof Error && 'status' in caught
      ? authError(caught)
      : error('No se pudieron cargar las personas', 500);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = createPersonSchema.safeParse(await request.json());
    if (!parsed.success)
      return error(
        'Revisá los campos marcados',
        400,
        fieldErrors(parsed.error),
      );
    await requireMembership(
      request,
      parsed.data.careGroupId,
      parsed.data.access ? 'admin' : undefined,
    );
    const db = getD1();
    if (parsed.data.access) {
      const duplicate = await db
        .prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE')
        .bind(parsed.data.access.username)
        .first();
      if (duplicate) return error('Ese nombre de usuario ya está en uso', 409);
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const statements = [
      db
        .prepare(
          'INSERT INTO persons (id, care_group_id, name, birth_date, relationship, notes, archived, version) VALUES (?, ?, ?, ?, ?, ?, 0, 1)',
        )
        .bind(
          id,
          parsed.data.careGroupId,
          parsed.data.data.name,
          parsed.data.data.birthDate,
          parsed.data.data.relationship,
          parsed.data.data.notes,
        ),
    ];
    if (parsed.data.access) {
      const userId = crypto.randomUUID();
      statements.push(
        db
          .prepare(
            `INSERT INTO users (id, username, display_name, password_hash, user_type, failed_login_count, created_at, last_seen_at)
           VALUES (?, ?, ?, ?, 'elder', 0, ?, ?)`,
          )
          .bind(
            userId,
            parsed.data.access.username,
            parsed.data.data.name,
            await hashPassword(parsed.data.access.password),
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
          .bind(id, userId, now),
      );
    }
    await db.batch(statements);
    return Response.json({ id }, { status: 201 });
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
    const db = getD1();
    const [result] = await db.batch([
      db
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
        ),
      db
        .prepare(
          `UPDATE users SET display_name = ? WHERE id = (
          SELECT user_id FROM person_access WHERE person_id = ?
        )`,
        )
        .bind(parsed.data.name, id.data),
    ]);
    if (!result.meta.changes)
      return error(
        'El perfil cambió en otro dispositivo. Recargá e intentá nuevamente.',
        409,
      );
    return Response.json({ ok: true });
  } catch (caught) {
    return caught instanceof Error && 'status' in caught
      ? authError(caught)
      : error('No se pudo actualizar el perfil', 500);
  }
}
