import { getD1 } from '@/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import {
  authError,
  clearSessionCookie,
  requireSameOrigin,
  requireUser,
} from '@/lib/server-auth';
import { changePasswordSchema, fieldErrors } from '@/lib/validation';
import { readJson } from '@/lib/api-response';

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser(request);
    const parsed = changePasswordSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return Response.json(
        { error: 'Revisá las contraseñas', details: fieldErrors(parsed.error) },
        { status: 400 },
      );
    const stored = await getD1()
      .prepare('SELECT password_hash AS passwordHash FROM users WHERE id = ?')
      .bind(user.id)
      .first<{ passwordHash: string }>();
    if (
      !stored ||
      !(await verifyPassword(parsed.data.currentPassword, stored.passwordHash))
    )
      return Response.json(
        { error: 'La contraseña actual no es correcta' },
        { status: 400 },
      );
    const now = new Date().toISOString();
    const db = getD1();
    await db.batch([
      db
        .prepare(
          'UPDATE users SET password_hash = ?, failed_login_count = 0, locked_until = NULL WHERE id = ?',
        )
        .bind(await hashPassword(parsed.data.newPassword), user.id),
      db
        .prepare(
          'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
        )
        .bind(now, user.id),
    ]);
    return Response.json(
      { ok: true },
      { headers: { 'Set-Cookie': clearSessionCookie(request) } },
    );
  } catch (error) {
    return authError(error);
  }
}
