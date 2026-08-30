import { getD1 } from '@/db';
import type {
  CareGroup,
  GroupData,
  GroupInvitation,
  GroupMember,
} from '@/lib/models';
import { authError, requireMembership, requireUser } from '@/lib/server-auth';
import { careGroupSchema } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('careGroupId') || '';
    const membership = await requireMembership(request, id);
    const db = getD1();
    const group = await db
      .prepare(`SELECT g.id, g.name, ? AS role,
      (SELECT COUNT(*) FROM memberships WHERE care_group_id = g.id) AS memberCount,
      (SELECT COUNT(*) FROM persons WHERE care_group_id = g.id) AS personCount FROM care_groups g WHERE g.id = ?`)
      .bind(membership.role, id)
      .first<CareGroup>();
    if (!group)
      return Response.json({ error: 'El grupo no existe' }, { status: 404 });
    const [members, invitations, persons] = await Promise.all([
      db
        .prepare(
          `SELECT u.id, u.username, u.display_name AS displayName, u.email, m.role FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.care_group_id = ? ORDER BY CASE m.role WHEN 'admin' THEN 0 ELSE 1 END, u.display_name`,
        )
        .bind(id)
        .all<GroupMember>(),
      db
        .prepare(
          `SELECT i.id, i.status, i.expires_at AS expiresAt, u.display_name AS createdByName FROM care_group_invitations i JOIN users u ON u.id = i.created_by_user_id WHERE i.care_group_id = ? ORDER BY i.created_at DESC`,
        )
        .bind(id)
        .all<GroupInvitation>(),
      db
        .prepare(
          'SELECT id, name, archived FROM persons WHERE care_group_id = ? ORDER BY archived, name COLLATE NOCASE',
        )
        .bind(id)
        .all<{ id: string; name: string; archived: number }>(),
    ]);
    return Response.json({
      group: {
        ...group,
        memberCount: Number(group.memberCount),
        personCount: Number(group.personCount),
      },
      members: members.results,
      invitations: invitations.results,
      persons: persons.results.map((person) => ({
        ...person,
        archived: Boolean(person.archived),
      })),
    } satisfies GroupData);
  } catch (error) {
    return authError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const parsed = careGroupSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const db = getD1();
    await db.batch([
      db
        .prepare(
          'INSERT INTO care_groups (id, name, created_at) VALUES (?, ?, ?)',
        )
        .bind(id, parsed.data.name, now),
      db
        .prepare(
          "INSERT INTO memberships (id, user_id, care_group_id, role, created_at) VALUES (?, ?, ?, 'admin', ?)",
        )
        .bind(crypto.randomUUID(), user.id, id, now),
    ]);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; name?: string };
    await requireMembership(request, body.id || '', 'admin');
    const parsed = careGroupSchema.safeParse({ name: body.name });
    if (!parsed.success)
      return Response.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 },
      );
    await getD1()
      .prepare('UPDATE care_groups SET name = ? WHERE id = ?')
      .bind(parsed.data.name, body.id)
      .run();
    return Response.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}
