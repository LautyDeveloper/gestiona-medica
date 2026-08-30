import { getD1 } from '@/db';
import { authError, hashToken, requireUser } from '@/lib/server-auth';
import { invitationActionSchema } from '@/lib/validation';

type Context = { params: Promise<{ token: string }> };

async function invitation(token: string) {
  return getD1()
    .prepare(
      `SELECT i.id, i.care_group_id AS careGroupId, i.status, i.expires_at AS expiresAt, g.name AS groupName, u.display_name AS inviterName FROM care_group_invitations i JOIN care_groups g ON g.id = i.care_group_id JOIN users u ON u.id = i.created_by_user_id WHERE i.token_hash = ?`,
    )
    .bind(await hashToken(token))
    .first<{
      id: string;
      careGroupId: string;
      status: string;
      expiresAt: string;
      groupName: string;
      inviterName: string;
    }>();
}

export async function GET(_: Request, context: Context) {
  const item = await invitation((await context.params).token);
  if (!item)
    return Response.json({ error: 'La invitación no existe' }, { status: 404 });
  const expired =
    item.status === 'pending' && item.expiresAt <= new Date().toISOString();
  return Response.json({
    groupName: item.groupName,
    inviterName: item.inviterName,
    status: expired ? 'expired' : item.status,
    expiresAt: item.expiresAt,
  });
}

export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser(request);
    const parsed = invitationActionSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json({ error: 'Acción inválida' }, { status: 400 });
    const item = await invitation((await context.params).token);
    if (!item)
      return Response.json(
        { error: 'La invitación no existe' },
        { status: 404 },
      );
    if (item.status !== 'pending' || item.expiresAt <= new Date().toISOString())
      return Response.json(
        { error: 'La invitación venció o ya fue utilizada' },
        { status: 409 },
      );
    const now = new Date().toISOString();
    const db = getD1();
    const statements = [
      db
        .prepare(
          "UPDATE care_group_invitations SET status = ?, responded_by_user_id = ?, responded_at = ? WHERE id = ? AND status = 'pending'",
        )
        .bind(
          parsed.data.action === 'accept' ? 'accepted' : 'rejected',
          user.id,
          now,
          item.id,
        ),
    ];
    if (parsed.data.action === 'accept')
      statements.push(
        db
          .prepare(
            "INSERT OR IGNORE INTO memberships (id, user_id, care_group_id, role, created_at) SELECT ?, ?, care_group_id, 'member', ? FROM care_group_invitations WHERE id = ? AND status = 'accepted' AND responded_by_user_id = ?",
          )
          .bind(crypto.randomUUID(), user.id, now, item.id, user.id),
      );
    const results = await db.batch(statements);
    if (!results[0]?.meta.changes)
      return Response.json(
        { error: 'La invitación ya fue utilizada' },
        { status: 409 },
      );
    return Response.json({ ok: true, careGroupId: item.careGroupId });
  } catch (error) {
    return authError(error);
  }
}
