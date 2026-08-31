import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock('@/db', () => ({ getD1: mocks.getD1 }));
vi.mock('@/lib/server-auth', () => ({
  requireUser: mocks.requireUser,
  authError: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    ),
}));

import { GET } from '@/app/api/session/route';

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getD1.mockReset();
  mocks.requireUser.mockReset();
});

describe('sesión discriminada por tipo de usuario', () => {
  it('devuelve solamente la persona vinculada para una cuenta elder', async () => {
    mocks.requireUser.mockResolvedValue({
      id: 'elder-1',
      username: 'maria',
      displayName: 'María',
      userType: 'elder',
    });
    mocks.getD1.mockReturnValue({
      prepare: () => ({
        bind() {
          return this;
        },
        first: async () => ({
          id: 'person-1',
          name: 'María',
          careGroupId: 'group-1',
        }),
      }),
    });

    const response = await GET(new Request('http://localhost/api/session'));
    await expect(response.json()).resolves.toEqual({
      user: {
        id: 'elder-1',
        username: 'maria',
        displayName: 'María',
        userType: 'elder',
      },
      groups: [],
      elderPerson: {
        id: 'person-1',
        name: 'María',
        careGroupId: 'group-1',
      },
    });
  });
});
