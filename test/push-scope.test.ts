import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ prepare: vi.fn() }));

vi.mock('@/db', () => ({ getD1: () => ({ prepare: mocks.prepare }) }));

import { loadAlertScopesForUser } from '@/lib/server-alerts';

beforeEach(() => {
  mocks.prepare.mockReset();
});

describe('alcance de notificaciones por cuenta', () => {
  it('incluye todos los grupos del cuidador', async () => {
    mocks.prepare.mockReturnValue({
      bind: () => ({
        all: async () => ({ results: [{ careGroupId: 'g1' }, { careGroupId: 'g2' }] }),
      }),
    });
    await expect(
      loadAlertScopesForUser({
        id: 'u1',
        username: 'ana',
        displayName: 'Ana',
        userType: 'caregiver',
      }),
    ).resolves.toMatchObject([
      { careGroupId: 'g1', personId: null },
      { careGroupId: 'g2', personId: null },
    ]);
  });

  it('limita la cuenta vinculada a su perfil activo', async () => {
    mocks.prepare.mockReturnValue({
      bind: () => ({
        first: async () => ({ id: 'p1', careGroupId: 'g1' }),
      }),
    });
    await expect(
      loadAlertScopesForUser({
        id: 'u2',
        username: 'maria',
        displayName: 'María',
        userType: 'elder',
      }),
    ).resolves.toMatchObject([{ careGroupId: 'g1', personId: 'p1' }]);
  });
});
