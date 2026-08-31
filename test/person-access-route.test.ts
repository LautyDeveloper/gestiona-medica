import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(),
  requireMembership: vi.fn(),
  hashPassword: vi.fn(async () => 'hashed-password'),
}));

vi.mock('@/db', () => ({ getD1: mocks.getD1 }));
vi.mock('@/lib/password', () => ({ hashPassword: mocks.hashPassword }));
vi.mock('@/lib/server-auth', () => ({
  requireMembership: mocks.requireMembership,
  authError: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    ),
}));

import { DELETE, PATCH, POST } from '@/app/api/person/access/route';

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getD1.mockReset();
  mocks.requireMembership.mockReset();
  mocks.hashPassword.mockClear();
});

function database(userId: string | null) {
  const batches: Array<Array<{ sql: string; values: unknown[] }>> = [];
  const db = {
    prepare(sql: string) {
      return {
        sql,
        values: [] as unknown[],
        bind(...values: unknown[]) {
          this.values = values;
          return this;
        },
        first: async () =>
          sql.includes('FROM persons p')
            ? { name: 'María', archived: 0, userId }
            : null,
      };
    },
    async batch(statements: Array<{ sql: string; values: unknown[] }>) {
      batches.push(statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
  return { db, batches };
}

const ids = {
  careGroupId: '11111111-1111-4111-8111-111111111111',
  personId: '22222222-2222-4222-8222-222222222222',
};

describe('gestión del acceso de una persona', () => {
  it('crea una cuenta elder vinculada', async () => {
    const { db, batches } = database(null);
    mocks.getD1.mockReturnValue(db);
    const response = await POST(
      new Request('http://localhost/api/person/access', {
        method: 'POST',
        body: JSON.stringify({
          ...ids,
          username: 'maria',
          password: 'clave-segura',
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(batches[0]).toHaveLength(3);
  });

  it('restablece contraseña y revoca las sesiones activas', async () => {
    const { db, batches } = database('elder-1');
    mocks.getD1.mockReturnValue(db);
    const response = await PATCH(
      new Request('http://localhost/api/person/access', {
        method: 'PATCH',
        body: JSON.stringify({ ...ids, password: 'otra-clave-segura' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(batches[0]).toHaveLength(2);
    expect(batches[0]?.[1]?.sql).toContain('UPDATE sessions');
  });

  it('desactiva la cuenta sin borrar el perfil', async () => {
    const { db, batches } = database('elder-1');
    mocks.getD1.mockReturnValue(db);
    const response = await DELETE(
      new Request('http://localhost/api/person/access', {
        method: 'DELETE',
        body: JSON.stringify(ids),
      }),
    );

    expect(response.status).toBe(200);
    expect(batches[0]).toHaveLength(4);
    expect(
      batches[0]?.every(({ sql }) => !sql.includes('DELETE FROM persons')),
    ).toBe(true);
  });
});
