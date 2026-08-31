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

import { POST } from '@/app/api/person/route';

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getD1.mockReset();
  mocks.requireMembership.mockReset();
  mocks.hashPassword.mockClear();
});

function database(duplicate = false) {
  const batched: Array<{ sql: string; values: unknown[] }> = [];
  const db = {
    prepare(sql: string) {
      return {
        sql,
        values: [] as unknown[],
        bind(...values: unknown[]) {
          this.values = values;
          return this;
        },
        first: async () => (duplicate ? { exists: 1 } : null),
      };
    },
    async batch(statements: Array<{ sql: string; values: unknown[] }>) {
      batched.push(...statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
  return { db, batched };
}

const person = {
  name: 'María',
  birthDate: '1940-05-12',
  relationship: 'Abuela',
  notes: '',
};

describe('alta de persona con acceso opcional', () => {
  it('crea solamente el perfil cuando no se solicitan credenciales', async () => {
    const { db, batched } = database();
    mocks.getD1.mockReturnValue(db);
    const response = await POST(
      new Request('http://localhost/api/person', {
        method: 'POST',
        body: JSON.stringify({
          careGroupId: '11111111-1111-4111-8111-111111111111',
          data: person,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(batched).toHaveLength(1);
    expect(mocks.requireMembership).toHaveBeenCalledWith(
      expect.any(Request),
      '11111111-1111-4111-8111-111111111111',
      undefined,
    );
  });

  it('crea perfil, cuenta elder, membresía y vínculo en un solo batch', async () => {
    const { db, batched } = database();
    mocks.getD1.mockReturnValue(db);
    const response = await POST(
      new Request('http://localhost/api/person', {
        method: 'POST',
        body: JSON.stringify({
          careGroupId: '11111111-1111-4111-8111-111111111111',
          data: person,
          access: { username: 'maria', password: 'clave-segura' },
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(batched).toHaveLength(4);
    expect(batched[1]?.sql).toContain("'elder'");
    expect(batched[2]?.sql).toContain("'member'");
    expect(batched[3]?.sql).toContain('person_access');
    expect(mocks.requireMembership).toHaveBeenCalledWith(
      expect.any(Request),
      '11111111-1111-4111-8111-111111111111',
      'admin',
    );
  });

  it('rechaza un usuario duplicado sin escribir ninguna entidad', async () => {
    const { db, batched } = database(true);
    mocks.getD1.mockReturnValue(db);
    const response = await POST(
      new Request('http://localhost/api/person', {
        method: 'POST',
        body: JSON.stringify({
          careGroupId: '11111111-1111-4111-8111-111111111111',
          data: person,
          access: { username: 'maria', password: 'clave-segura' },
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(batched).toHaveLength(0);
  });
});
