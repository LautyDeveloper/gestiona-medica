import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(),
  verifyPassword: vi.fn(async () => true),
  createSession: vi.fn(async () => 'cerca_session=token; Path=/'),
}));

vi.mock('@/db', () => ({ getD1: mocks.getD1 }));
vi.mock('@/lib/password', () => ({ verifyPassword: mocks.verifyPassword }));
vi.mock('@/lib/server-auth', () => ({
  authError: () => Response.json({ error: 'Error' }, { status: 500 }),
  createSession: mocks.createSession,
  requireSameOrigin: () => {},
}));

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
      batch: async (statements: unknown[]) =>
        statements.map(() => ({ meta: { changes: 1 } })),
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

  it('incrementa intentos de cuenta de forma atómica y registra el límite por IP', async () => {
    const batches: Array<Array<{ sql: string; values: unknown[] }>> = [];
    mocks.verifyPassword.mockResolvedValueOnce(false);
    mocks.getD1.mockReturnValue({
      prepare(sql: string) {
        return {
          sql,
          values: [] as unknown[],
          bind(...values: unknown[]) {
            this.values = values;
            return this;
          },
          first: async () =>
            sql.includes('login_rate_limits')
              ? null
              : {
                  id: 'caregiver-1',
                  userType: 'caregiver',
                  passwordHash: 'hash',
                  failedLoginCount: 4,
                  lockedUntil: null,
                },
        };
      },
      async batch(statements: Array<{ sql: string; values: unknown[] }>) {
        batches.push(statements);
        return statements.map(() => ({ meta: { changes: 1 } }));
      },
    });

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '203.0.113.10' },
        body: JSON.stringify({ username: 'ana', password: 'incorrecta' }),
      }),
    );

    expect(response.status).toBe(401);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.[0]?.sql).toContain(
      'failed_login_count = failed_login_count + 1',
    );
    expect(batches[0]?.[1]?.sql).toContain('ON CONFLICT(key_hash)');
  });

  it('detiene el login cuando la IP está temporalmente bloqueada', async () => {
    mocks.getD1.mockReturnValue({
      prepare: () => ({
        bind() {
          return this;
        },
        first: async () => ({ blockedUntil: '2999-01-01T00:00:00.000Z' }),
      }),
    });

    const response = await POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '203.0.113.10' },
        body: JSON.stringify({ username: 'ana', password: 'incorrecta' }),
      }),
    );

    expect(response.status).toBe(429);
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });
});
