import { getD1 } from '@/db';
import type { CareGroup, SessionData } from '@/lib/models';
import { authError, requireUser } from '@/lib/server-auth';

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const groups = await getD1()
      .prepare(`SELECT g.id, g.name, m.role,
      (SELECT COUNT(*) FROM memberships mm WHERE mm.care_group_id = g.id) AS memberCount,
      (SELECT COUNT(*) FROM persons p WHERE p.care_group_id = g.id) AS personCount
      FROM memberships m JOIN care_groups g ON g.id = m.care_group_id
      WHERE m.user_id = ? ORDER BY g.created_at, g.id LIMIT 1`)
      .bind(user.id)
      .all<CareGroup>();
    return Response.json({
      user,
      groups: groups.results.map((group) => ({
        ...group,
        memberCount: Number(group.memberCount),
        personCount: Number(group.personCount),
      })),
    } satisfies SessionData);
  } catch (error) {
    return authError(error);
  }
}
