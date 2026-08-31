import { getD1 } from '@/db';
import type { AppUser, MembershipRole } from '@/lib/models';

export const SESSION_COOKIE = 'cerca_session';
const SESSION_SECONDS = 7 * 24 * 60 * 60;

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 401,
  ) {
    super(message);
  }
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
  await getD1()
    .prepare(
      'INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
    )
    .bind(
      crypto.randomUUID(),
      userId,
      await hashToken(token),
      now.toISOString(),
      expiresAt.toISOString(),
    )
    .run();
  return sessionCookie(request, token);
}

export async function requireUser(request: Request): Promise<AppUser> {
  const token = readSessionToken(request);
  if (!token) throw new AuthError('Iniciá sesión para continuar');
  const now = new Date().toISOString();
  const user = await getD1()
    .prepare(
      `SELECT u.id, u.username, u.display_name AS displayName
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > ?
         AND u.user_type = 'caregiver'`,
    )
    .bind(await hashToken(token), now)
    .first<AppUser>();
  if (!user) throw new AuthError('La sesión venció o no es válida');
  await getD1()
    .prepare('UPDATE users SET last_seen_at = ? WHERE id = ?')
    .bind(now, user.id)
    .run();
  return user;
}

export async function requireMembership(
  request: Request,
  careGroupId: string,
  role?: MembershipRole,
) {
  const user = await requireUser(request);
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
  if (error instanceof AuthError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    'Authentication request failed',
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { type: typeof error },
  );
  return Response.json(
    { error: 'Ocurrió un error inesperado' },
    { status: 500 },
  );
}
