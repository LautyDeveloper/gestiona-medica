import { getD1 } from '@/db';
import type { CareGroup, GroupData, GroupMember } from '@/lib/models';
import { authError, requireMembership } from '@/lib/server-auth';
import { careGroupSchema } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('careGroupId') || '';
    const membership = await requireMembership(request, id);
    const db = getD1();
    const group = await db
      .prepare(`SELECT g.id, g.name, ? AS role,
      (SELECT COUNT(*) FROM memberships cm JOIN users cu ON cu.id = cm.user_id WHERE cm.care_group_id = g.id AND cu.user_type = 'caregiver') AS memberCount,
      (SELECT COUNT(*) FROM persons WHERE care_group_id = g.id) AS personCount FROM care_groups g WHERE g.id = ?`)
      .bind(membership.role, id)
      .first<CareGroup>();
    if (!group)
      return Response.json({ error: 'El grupo no existe' }, { status: 404 });
    const [members, persons] = await Promise.all([
      db
        .prepare(
          `SELECT u.id, u.username, u.display_name AS displayName, m.role
           FROM memberships m JOIN users u ON u.id = m.user_id
           WHERE m.care_group_id = ? AND u.user_type = 'caregiver'
           ORDER BY u.display_name COLLATE NOCASE`,
        )
        .bind(id)
        .all<GroupMember>(),
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
      persons: persons.results.map((person) => ({
        ...person,
        archived: Boolean(person.archived),
      })),
    } satisfies GroupData);
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
