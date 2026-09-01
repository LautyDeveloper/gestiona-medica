import { getD1 } from '@/db';
import type { AppUser, MembershipRole } from '@/lib/models';
import { handleApiError, HttpError } from '@/lib/api-response';

export const SESSION_COOKIE = 'cerca_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;
const REVOKED_SESSION_RETENTION_SECONDS = 7 * 24 * 60 * 60;
const LAST_SEEN_INTERVAL_SECONDS = 10 * 60;

export class AuthError extends HttpError {
  constructor(
    message: string,
    public status = 401,
  ) {
    super(message, status);
  }
}

export function requireSameOrigin(request: Request) {
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site')
    throw new AuthError('La solicitud proviene de un sitio no autorizado', 403);

  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    throw new AuthError('La solicitud proviene de un sitio no autorizado', 403);
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export function readSessionToken(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(value.join('='));
  }
  return '';
}

export function sessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function createSession(request: Request, userId: string) {
  const token = randomToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_SECONDS * 1000);
  const revokedBefore = new Date(
    now.getTime() - REVOKED_SESSION_RETENTION_SECONDS * 1000,
  );
  const db = getD1();
  await db.batch([
    db
      .prepare(
        `DELETE FROM sessions
         WHERE expires_at <= ? OR (revoked_at IS NOT NULL AND revoked_at <= ?)`,
      )
      .bind(now.toISOString(), revokedBefore.toISOString()),
    db
      .prepare(
        'INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(
        crypto.randomUUID(),
        userId,
        await hashToken(token),
        now.toISOString(),
        expiresAt.toISOString(),
      ),
  ]);
  return sessionCookie(request, token);
}

export async function requireUser(request: Request): Promise<AppUser> {
  const token = readSessionToken(request);
  if (!token) throw new AuthError('Iniciá sesión para continuar');
  const now = new Date().toISOString();
  const db = getD1();
  const user = await db
    .prepare(
      `SELECT u.id, u.username, u.display_name AS displayName, u.user_type AS userType,
         u.last_seen_at AS lastSeenAt
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
         AND u.user_type IN ('caregiver', 'elder')`,
    )
    .bind(await hashToken(token), now)
    .first<AppUser & { lastSeenAt: string }>();
  if (!user) throw new AuthError('La sesión venció o no es válida');
  const lastSeenCutoff = new Date(
    Date.now() - LAST_SEEN_INTERVAL_SECONDS * 1000,
  ).toISOString();
  if (user.lastSeenAt <= lastSeenCutoff)
    await db
      .prepare(
        'UPDATE users SET last_seen_at = ? WHERE id = ? AND last_seen_at <= ?',
      )
      .bind(now, user.id, lastSeenCutoff)
      .run();
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    userType: user.userType,
  };
}

export async function requireCaregiver(request: Request) {
  const user = await requireUser(request);
  if (user.userType !== 'caregiver')
    throw new AuthError('Esta acción requiere una cuenta de cuidador', 403);
  return user;
}

export async function requireElder(
  request: Request,
): Promise<AppUser & { userType: 'elder' }> {
  const user = await requireUser(request);
  if (user.userType !== 'elder')
    throw new AuthError(
      'Esta sección es exclusiva para cuentas de abuelo',
      403,
    );
  return { ...user, userType: 'elder' };
}

export async function requireMembership(
  request: Request,
  careGroupId: string,
  role?: MembershipRole,
) {
  const user = await requireCaregiver(request);
  const membership = await getD1()
    .prepare(
      'SELECT role FROM memberships WHERE user_id = ? AND care_group_id = ?',
    )
    .bind(user.id, careGroupId)
    .first<{ role: MembershipRole }>();
  if (!membership) throw new AuthError('No tenés acceso a este grupo', 403);
  if (role === 'admin' && membership.role !== 'admin')
    throw new AuthError('Esta acción requiere permisos de cuidador', 403);
  return { user, role: membership.role };
}

export function authError(error: unknown) {
  return handleApiError(error, 'Ocurrió un error inesperado');
}
