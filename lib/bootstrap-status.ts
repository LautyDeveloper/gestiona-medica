import { isPasswordHashSupported } from '@/lib/password';

export type BootstrapState = 'setup-required' | 'ready' | 'invalid';

export type BootstrapStatus = {
  state: BootstrapState;
  setupRequired: boolean;
};

export async function getBootstrapStatus(
  db: D1Database,
): Promise<BootstrapStatus> {
  const row = await db
    .prepare('SELECT COUNT(*) AS count FROM users')
    .first<{ count: number }>();
  if (Number(row?.count || 0) === 0)
    return { state: 'setup-required', setupRequired: true };

  const admins = await db
    .prepare(
      `SELECT DISTINCT u.password_hash AS passwordHash
       FROM users u
       JOIN memberships m ON m.user_id = u.id AND m.role = 'admin'
       JOIN care_groups g ON g.id = m.care_group_id
       WHERE u.user_type = 'caregiver'`,
    )
    .all<{ passwordHash: string }>();
  const ready = admins.results.some(({ passwordHash }) =>
    isPasswordHashSupported(passwordHash),
  );
  return {
    state: ready ? 'ready' : 'invalid',
    setupRequired: false,
  };
}
