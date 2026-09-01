import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(),
  requireMembership: vi.fn(),
}));

vi.mock('@/db', () => ({ getD1: mocks.getD1 }));
vi.mock('@/lib/server-auth', () => ({
  requireMembership: mocks.requireMembership,
  requireSameOrigin: () => {},
  authError: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    ),
}));

import { POST } from '@/app/api/users/route';

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getD1.mockReset();
  mocks.requireMembership.mockReset();
});

describe('alta de cuidadores', () => {
  it('crea siempre un cuidador administrador aunque un cliente antiguo envíe elder', async () => {
    const batched: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      prepare(sql: string) {
        const statement = {
          sql,
          values: [] as unknown[],
          bind(...values: unknown[]) {
            this.values = values;
            return this;
          },
          first: async () => null,
        };
        return statement;
      },
      async batch(statements: Array<{ sql: string; values: unknown[] }>) {
        batched.push(...statements);
        return statements.map(() => ({ meta: { changes: 1 } }));
      },
    };
    mocks.getD1.mockReturnValue(db);
    mocks.requireMembership.mockResolvedValue({
      user: { id: 'admin' },
      role: 'admin',
    });

    const response = await POST(
      new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          careGroupId: '11111111-1111-4111-8111-111111111111',
          username: 'lucre',
          displayName: 'Lucrecia',
          password: 'contraseña-segura',
          userType: 'elder',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.requireMembership).toHaveBeenCalledWith(
      expect.any(Request),
      '11111111-1111-4111-8111-111111111111',
      'admin',
    );
    expect(batched).toHaveLength(2);
    expect(batched[0]?.values[4]).toBe('caregiver');
    expect(batched[1]?.values[3]).toBe('admin');
  });
});
