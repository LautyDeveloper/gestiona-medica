import { env } from 'cloudflare:workers';
import { createRemoteJWKSet } from 'jose';
import { getD1 } from '@/db';
import type { AppUser, MembershipRole } from '@/lib/models';
import { verifyAccessToken } from '@/lib/auth-token';

const LEGACY_GROUP_ID = '00000000-0000-4000-8000-000000000003';
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksDomain = '';

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 401,
  ) {
    super(message);
  }
}

export function authConfig() {
  const domain = (env.AUTH0_DOMAIN || process.env.AUTH0_DOMAIN)
    ?.replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
  const clientId = env.AUTH0_CLIENT_ID || process.env.AUTH0_CLIENT_ID;
  const audience = env.AUTH0_AUDIENCE || process.env.AUTH0_AUDIENCE;
  if (!domain || !clientId || !audience)
    throw new AuthError('La autenticación todavía no está configurada', 503);
  return { domain, clientId, audience };
}

async function profile(token: string, domain: string) {
  const response = await fetch(`https://${domain}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new AuthError('No se pudo verificar el perfil');
  return response.json() as Promise<{
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    nickname?: string;
  }>;
}

export async function requireUser(request: Request): Promise<AppUser> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer '))
    throw new AuthError('Iniciá sesión para continuar');
  const token = header.slice(7);
  const config = authConfig();
  if (!jwks || jwksDomain !== config.domain) {
    jwksDomain = config.domain;
    jwks = createRemoteJWKSet(
      new URL(`https://${config.domain}/.well-known/jwks.json`),
    );
  }
  let subject = '';
  try {
    subject = await verifyAccessToken(
      token,
      jwks,
      `https://${config.domain}/`,
      config.audience,
    );
  } catch {
    throw new AuthError('La sesión venció o no es válida');
  }
  if (!subject) throw new AuthError('La sesión no identifica a un usuario');

  const db = getD1();
  let user = await db
    .prepare(
      'SELECT id, username, display_name AS displayName, email FROM users WHERE auth_subject = ?',
    )
    .bind(subject)
    .first<AppUser>();
  const now = new Date().toISOString();
  if (!user) {
    const authProfile = await profile(token, config.domain);
    if (!authProfile.email || !authProfile.email_verified)
      throw new AuthError('Verificá tu correo antes de continuar', 403);
    user = {
      id: crypto.randomUUID(),
      username: authProfile.nickname || authProfile.email.split('@')[0],
      displayName:
        authProfile.name || authProfile.nickname || authProfile.email,
      email: authProfile.email,
    };
    await db
      .prepare(
        'INSERT INTO users (id, auth_subject, username, display_name, email, email_verified, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
      )
      .bind(
        user.id,
        subject,
        user.username,
        user.displayName,
        user.email,
        now,
        now,
      )
      .run();
  } else {
    await db
      .prepare('UPDATE users SET last_seen_at = ? WHERE id = ?')
      .bind(now, user.id)
      .run();
  }
  const ownerEmail = (
    env.INITIAL_OWNER_EMAIL || process.env.INITIAL_OWNER_EMAIL
  )
    ?.trim()
    .toLowerCase();
  if (ownerEmail && user.email.toLowerCase() === ownerEmail) {
    await db
      .prepare(`INSERT OR IGNORE INTO memberships (id, user_id, care_group_id, role, created_at)
      SELECT ?, ?, id, 'admin', ? FROM care_groups WHERE id = ? AND EXISTS (SELECT 1 FROM persons WHERE care_group_id = ?)`)
      .bind(crypto.randomUUID(), user.id, now, LEGACY_GROUP_ID, LEGACY_GROUP_ID)
      .run();
  }
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
    throw new AuthError('Esta acción requiere permisos de administrador', 403);
  return { user, role: membership.role };
}

export function authError(error: unknown) {
  if (error instanceof AuthError)
    return Response.json({ error: error.message }, { status: error.status });
  return Response.json(
    { error: 'Ocurrió un error inesperado' },
    { status: 500 },
  );
}

export async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
