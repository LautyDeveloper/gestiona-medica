import { getD1 } from '@/db';
import { verifyPassword } from '@/lib/password';
import { createSession } from '@/lib/server-auth';
import { loginSchema } from '@/lib/validation';

type LoginUser = {
  id: string;
  passwordHash: string;
  failedLoginCount: number;
  lockedUntil: string | null;
};

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success)
    return Response.json(
      { error: 'Ingresá usuario y contraseña' },
      { status: 400 },
    );
  const db = getD1();
  const user = await db
    .prepare(
      `SELECT id, password_hash AS passwordHash, failed_login_count AS failedLoginCount,
       locked_until AS lockedUntil FROM users WHERE username = ? COLLATE NOCASE`,
    )
    .bind(parsed.data.username)
    .first<LoginUser>();
  const now = new Date();
  if (user?.lockedUntil && user.lockedUntil > now.toISOString())
    return Response.json(
      { error: 'La cuenta está bloqueada temporalmente. Intentá más tarde.' },
      { status: 429 },
    );
  const valid = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : false;
  if (!user || !valid) {
    if (user) {
      const attempts = user.failedLoginCount + 1;
      const lockedUntil =
        attempts >= 5
          ? new Date(now.getTime() + 15 * 60 * 1000).toISOString()
          : null;
      await db
        .prepare(
          'UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?',
        )
        .bind(attempts, lockedUntil, user.id)
        .run();
    }
    return Response.json(
      { error: 'Usuario o contraseña incorrectos' },
      { status: 401 },
    );
  }
  await db
    .prepare(
      'UPDATE users SET failed_login_count = 0, locked_until = NULL, last_seen_at = ? WHERE id = ?',
    )
    .bind(now.toISOString(), user.id)
    .run();
  const cookie = await createSession(request, user.id);
  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': cookie } },
  );
}
