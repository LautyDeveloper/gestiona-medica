import { getD1 } from '@/db';
import {
  authError,
  clearSessionCookie,
  hashToken,
  readSessionToken,
  requireSameOrigin,
} from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
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
  } catch (error) {
    return authError(error);
  }
}
