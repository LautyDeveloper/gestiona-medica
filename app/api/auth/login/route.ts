import { getD1 } from '@/db';
import { verifyPassword } from '@/lib/password';
import { authError, createSession, requireSameOrigin } from '@/lib/server-auth';
import { loginSchema } from '@/lib/validation';

const LOCK_MINUTES = 15;
const IP_ATTEMPT_LIMIT = 20;

type LoginUser = {
  id: string;
  userType: 'caregiver' | 'elder';
  passwordHash: string;
  failedLoginCount: number;
  lockedUntil: string | null;
};

async function rateLimitKey(request: Request) {
  const address =
    request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip');
  if (!address) return null;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(address),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: 'Ingresá usuario y contraseña' },
        { status: 400 },
      );
    const db = getD1();
    const keyHash = await rateLimitKey(request);
    const now = new Date();
    const nowText = now.toISOString();
    if (keyHash) {
      const rateLimit = await db
        .prepare(
          'SELECT blocked_until AS blockedUntil FROM login_rate_limits WHERE key_hash = ?',
        )
        .bind(keyHash)
        .first<{ blockedUntil: string | null }>();
      if (rateLimit?.blockedUntil && rateLimit.blockedUntil > nowText)
        return Response.json(
          { error: 'Demasiados intentos. Intentá nuevamente más tarde.' },
          { status: 429 },
        );
    }
    const user = await db
      .prepare(
        `SELECT id, user_type AS userType, password_hash AS passwordHash, failed_login_count AS failedLoginCount,
         locked_until AS lockedUntil FROM users WHERE username = ? COLLATE NOCASE`,
      )
      .bind(parsed.data.username)
      .first<LoginUser>();
    if (user?.lockedUntil && user.lockedUntil > nowText)
      return Response.json(
        { error: 'La cuenta está bloqueada temporalmente. Intentá más tarde.' },
        { status: 429 },
      );
    const valid = user
      ? await verifyPassword(parsed.data.password, user.passwordHash)
      : false;
    if (!user || !valid) {
      const lockUntil = new Date(
        now.getTime() + LOCK_MINUTES * 60 * 1000,
      ).toISOString();
      const windowCutoff = new Date(
        now.getTime() - LOCK_MINUTES * 60 * 1000,
      ).toISOString();
      const statements = [];
      if (user)
        statements.push(
          db
            .prepare(
              `UPDATE users
               SET failed_login_count = failed_login_count + 1,
                   locked_until = CASE WHEN failed_login_count + 1 >= 5 THEN ? ELSE locked_until END
               WHERE id = ?`,
            )
            .bind(lockUntil, user.id),
        );
      if (keyHash)
        statements.push(
          db
            .prepare(
              `INSERT INTO login_rate_limits (key_hash, attempt_count, window_started_at, blocked_until)
               VALUES (?, 1, ?, NULL)
               ON CONFLICT(key_hash) DO UPDATE SET
                 attempt_count = CASE WHEN window_started_at <= ? THEN 1 ELSE attempt_count + 1 END,
                 window_started_at = CASE WHEN window_started_at <= ? THEN ? ELSE window_started_at END,
                 blocked_until = CASE
                   WHEN window_started_at <= ? THEN NULL
                   WHEN attempt_count + 1 >= ? THEN ?
                   ELSE blocked_until
                 END`,
            )
            .bind(
              keyHash,
              nowText,
              windowCutoff,
              windowCutoff,
              nowText,
              windowCutoff,
              IP_ATTEMPT_LIMIT,
              lockUntil,
            ),
        );
      if (statements.length) await db.batch(statements);
      return Response.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 },
      );
    }
    const successStatements = [
      db
        .prepare(
          'UPDATE users SET failed_login_count = 0, locked_until = NULL, last_seen_at = ? WHERE id = ?',
        )
        .bind(nowText, user.id),
    ];
    if (keyHash)
      successStatements.push(
        db
          .prepare('DELETE FROM login_rate_limits WHERE key_hash = ?')
          .bind(keyHash),
      );
    await db.batch(successStatements);
    const cookie = await createSession(request, user.id);
    return Response.json(
      { ok: true, userType: user.userType },
      { headers: { 'Set-Cookie': cookie } },
    );
  } catch (error) {
    return authError(error);
  }
}
