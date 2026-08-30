import { getD1 } from '@/db';
import { hashPassword } from '@/lib/password';
import { authError, requireMembership } from '@/lib/server-auth';
import {
  createUserSchema,
  fieldErrors,
  resetPasswordSchema,
} from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const parsed = createUserSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: 'Revisá los datos ingresados', details: fieldErrors(parsed.error) },
        { status: 400 },
      );
    await requireMembership(request, parsed.data.careGroupId, 'admin');
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
           VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        )
        .bind(
          userId,
          parsed.data.username,
          parsed.data.displayName,
          await hashPassword(parsed.data.password),
          parsed.data.userType,
          now,
          now,
        ),
      db
        .prepare(
          'INSERT INTO memberships (id, user_id, care_group_id, role, created_at) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(
          crypto.randomUUID(),
          userId,
          parsed.data.careGroupId,
          parsed.data.userType === 'caregiver' ? 'admin' : 'member',
          now,
        ),
    ]);
    return Response.json({ id: userId }, { status: 201 });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const parsed = resetPasswordSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: 'Revisá la contraseña', details: fieldErrors(parsed.error) },
        { status: 400 },
      );
    await requireMembership(request, parsed.data.careGroupId, 'admin');
    const db = getD1();
    const target = await db
      .prepare(
        'SELECT 1 FROM memberships WHERE user_id = ? AND care_group_id = ?',
      )
      .bind(parsed.data.userId, parsed.data.careGroupId)
      .first();
    if (!target)
      return Response.json({ error: 'El usuario no existe' }, { status: 404 });
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(
          'UPDATE users SET password_hash = ?, failed_login_count = 0, locked_until = NULL WHERE id = ?',
        )
        .bind(await hashPassword(parsed.data.password), parsed.data.userId),
      db
        .prepare(
          'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
        )
        .bind(now, parsed.data.userId),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}
