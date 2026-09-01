import { getD1 } from '@/db';
import { getBootstrapStatus } from '@/lib/bootstrap-status';
import { hashPassword } from '@/lib/password';
import { authError, createSession, requireSameOrigin } from '@/lib/server-auth';
import { bootstrapSchema, fieldErrors } from '@/lib/validation';
import { readJson } from '@/lib/api-response';

export async function GET() {
  try {
    return Response.json(await getBootstrapStatus(getD1()), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error(
      'Bootstrap status check failed',
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : { type: typeof error },
    );
    return Response.json(
      {
        error: 'La base de datos no está preparada o no está disponible',
        code: 'DATABASE_UNAVAILABLE',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = bootstrapSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return Response.json(
        {
          error: 'Revisá los datos ingresados',
          details: fieldErrors(parsed.error),
        },
        { status: 400 },
      );
    const db = getD1();
    const status = await getBootstrapStatus(db);
    if (status.state !== 'setup-required')
      return Response.json(
        {
          error:
            status.state === 'invalid'
              ? 'La configuración de acceso está incompleta. Revisá la base de datos local.'
              : 'La configuración inicial ya fue completada',
          code:
            status.state === 'invalid'
              ? 'AUTH_CONFIGURATION_INVALID'
              : 'BOOTSTRAP_ALREADY_COMPLETED',
        },
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
