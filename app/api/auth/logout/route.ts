import { getD1 } from '@/db';
import {
  clearSessionCookie,
  hashToken,
  readSessionToken,
} from '@/lib/server-auth';

export async function POST(request: Request) {
  const token = readSessionToken(request);
  if (token)
    await getD1()
      .prepare(
        'UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL',
      )
      .bind(new Date().toISOString(), await hashToken(token))
      .run();
  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': clearSessionCookie(request) } },
  );
}
