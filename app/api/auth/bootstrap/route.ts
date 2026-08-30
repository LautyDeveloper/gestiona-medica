import { getD1 } from '@/db';
import { hashPassword } from '@/lib/password';
import { authError, createSession } from '@/lib/server-auth';
import { bootstrapSchema, fieldErrors } from '@/lib/validation';

export async function GET() {
  const row = await getD1()
    .prepare('SELECT COUNT(*) AS count FROM users')
    .first<{ count: number }>();
  return Response.json({ setupRequired: Number(row?.count || 0) === 0 });
}

export async function POST(request: Request) {
  try {
    const parsed = bootstrapSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: 'Revisá los datos ingresados', details: fieldErrors(parsed.error) },
        { status: 400 },
      );
    const db = getD1();
    const existing = await db
      .prepare('SELECT COUNT(*) AS count FROM users')
      .first<{ count: number }>();
    if (Number(existing?.count || 0) > 0)
      return Response.json(
        { error: 'La configuración inicial ya fue completada' },
        { status: 409 },
      );
    const currentGroup = await db
      .prepare('SELECT id FROM care_groups ORDER BY created_at, id LIMIT 1')
      .first<{ id: string }>();
    const groupId = currentGroup?.id || crypto.randomUUID();
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(parsed.data.password);
    const results = await db.batch([
      db
        .prepare(
          'INSERT OR IGNORE INTO care_groups (id, name, created_at) VALUES (?, ?, ?)',
        )
        .bind(groupId, parsed.data.groupName, now),
      db
        .prepare(
          'UPDATE care_groups SET name = ? WHERE id = ? AND NOT EXISTS (SELECT 1 FROM users)',
        )
        .bind(parsed.data.groupName, groupId),
      db
        .prepare(
          `INSERT INTO users (id, username, display_name, password_hash, user_type, failed_login_count, created_at, last_seen_at)
           SELECT ?, ?, ?, ?, 'caregiver', 0, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)`,
        )
        .bind(
          userId,
          parsed.data.username,
          parsed.data.displayName,
          passwordHash,
          now,
          now,
        ),
      db
        .prepare(
          `INSERT INTO memberships (id, user_id, care_group_id, role, created_at)
           SELECT ?, ?, ?, 'admin', ? WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)`,
        )
        .bind(crypto.randomUUID(), userId, groupId, now, userId),
    ]);
    if (!results[2].meta.changes)
      return Response.json(
        { error: 'La configuración inicial ya fue completada' },
        { status: 409 },
      );
    const cookie = await createSession(request, userId);
    return Response.json(
      { ok: true },
      { status: 201, headers: { 'Set-Cookie': cookie } },
    );
  } catch (error) {
    return authError(error);
  }
}
