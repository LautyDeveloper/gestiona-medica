import { getD1 } from '@/db';
import type { CareGroup, Person, SessionData } from '@/lib/models';
import { authError, requireUser } from '@/lib/server-auth';

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (user.userType === 'elder') {
      const elderPerson = await getD1()
        .prepare(
          `SELECT p.id, p.name, p.care_group_id AS careGroupId
           FROM person_access pa JOIN persons p ON p.id = pa.person_id
           WHERE pa.user_id = ? AND p.archived = 0`,
        )
        .bind(user.id)
        .first<Pick<Person, 'id' | 'name' | 'careGroupId'>>();
      if (!elderPerson)
        return Response.json(
          { error: 'Esta cuenta no tiene un perfil activo asociado' },
          { status: 403 },
        );
      return Response.json({
        user: { ...user, userType: 'elder' },
        groups: [],
        elderPerson,
      } satisfies SessionData);
    }
    const groups = await getD1()
      .prepare(`SELECT g.id, g.name, m.role,
      (SELECT COUNT(*) FROM memberships mm JOIN users mu ON mu.id = mm.user_id WHERE mm.care_group_id = g.id AND mu.user_type = 'caregiver') AS memberCount,
      (SELECT COUNT(*) FROM persons p WHERE p.care_group_id = g.id) AS personCount
      FROM memberships m JOIN care_groups g ON g.id = m.care_group_id
      WHERE m.user_id = ? ORDER BY g.created_at, g.id LIMIT 1`)
      .bind(user.id)
      .all<CareGroup>();
    return Response.json({
      user: { ...user, userType: 'caregiver' },
      groups: groups.results.map((group) => ({
        ...group,
        memberCount: Number(group.memberCount),
        personCount: Number(group.personCount),
      })),
      elderPerson: null,
    } satisfies SessionData);
  } catch (error) {
    return authError(error);
  }
}
