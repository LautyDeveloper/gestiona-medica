import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(),
  verifyPassword: vi.fn(async () => true),
  createSession: vi.fn(async () => 'cerca_session=token; Path=/'),
}));

vi.mock('@/db', () => ({ getD1: mocks.getD1 }));
vi.mock('@/lib/password', () => ({ verifyPassword: mocks.verifyPassword }));
vi.mock('@/lib/server-auth', () => ({ createSession: mocks.createSession }));

import { POST } from '@/app/api/auth/login/route';

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getD1.mockReset();
  mocks.verifyPassword.mockClear();
  mocks.createSession.mockClear();
});

describe('login por tipo de cuenta', () => {
  it('informa que la cuenta autenticada es elder', async () => {
    mocks.getD1.mockReturnValue({
      prepare: () => ({
        bind() {
          return this;
        },
        first: async () => ({
          id: 'elder-1',
          userType: 'elder',
          passwordHash: 'hash',
          failedLoginCount: 0,
          lockedUntil: null,
        }),
        run: async () => ({ meta: { changes: 1 } }),
      }),
    });

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'maria', password: 'clave-segura' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      userType: 'elder',
    });
    expect(response.headers.get('set-cookie')).toContain('cerca_session');
  });
});
