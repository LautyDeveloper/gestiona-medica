import { getD1 } from '@/db';
import { authError, hashToken, requireMembership } from '@/lib/server-auth';

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { careGroupId?: string };
    const membership = await requireMembership(
      request,
      body.careGroupId || '',
      'admin',
    );
    const token = randomToken();
    const now = new Date();
    const expires = new Date(now.getTime() + 7 * 86400000);
    await getD1()
      .prepare(
        `INSERT INTO care_group_invitations (id, care_group_id, token_hash, created_by_user_id, status, expires_at, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        body.careGroupId,
        await hashToken(token),
        membership.user.id,
        expires.toISOString(),
        now.toISOString(),
      )
      .run();
    return Response.json(
      { token, expiresAt: expires.toISOString() },
      { status: 201 },
    );
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const careGroupId = url.searchParams.get('careGroupId') || '';
    const id = url.searchParams.get('id') || '';
    await requireMembership(request, careGroupId, 'admin');
    const result = await getD1()
      .prepare(
        "UPDATE care_group_invitations SET status = 'revoked', responded_at = ? WHERE id = ? AND care_group_id = ? AND status = 'pending'",
      )
      .bind(new Date().toISOString(), id, careGroupId)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'La invitación ya no está disponible' },
        { status: 409 },
      );
    return Response.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}
