import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(),
  requireElder: vi.fn(),
}));

vi.mock('@/db', () => ({ getD1: mocks.getD1 }));
vi.mock('@/lib/server-auth', () => ({
  requireElder: mocks.requireElder,
  AuthError: class AuthError extends Error {
    constructor(
      message: string,
      public status = 401,
    ) {
      super(message);
    }
  },
  authError: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : 'Error' },
      {
        status:
          error instanceof Error && 'status' in error
            ? Number(error.status)
            : 500,
      },
    ),
}));

import { GET } from '@/app/api/elder/data/route';

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getD1.mockReset();
  mocks.requireElder.mockReset();
});

describe('datos propios de una cuenta elder', () => {
  it('deriva la persona de la sesión y devuelve solamente turnos y medicamentos', async () => {
    mocks.requireElder.mockResolvedValue({ id: 'elder-1', userType: 'elder' });
    const queries: Array<{ sql: string; values: unknown[] }> = [];
    mocks.getD1.mockReturnValue({
      prepare(sql: string) {
        const statement = {
          sql,
          values: [] as unknown[],
          bind(...values: unknown[]) {
            this.values = values;
            queries.push(this);
            return this;
          },
          first: async () => ({ id: 'person-1', name: 'María' }),
          all: async () => ({
            results: sql.includes('FROM medications')
              ? [
                  {
                    id: 'm1',
                    personId: 'person-1',
                    name: 'Losartán',
                    dose: '50 mg',
                    frequency: 'Diario',
                    doctor: 'Dra. A',
                    notes: '',
                    active: 1,
                  },
                ]
              : [],
          }),
        };
        return statement;
      },
    });

    const response = await GET(
      new Request('http://localhost/api/elder/data?personId=manipulado'),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      person: { id: 'person-1', name: 'María' },
      appointments: [],
      medications: [{ id: 'm1', active: true }],
    });
    expect(queries[0]?.values).toEqual(['elder-1']);
    expect(queries[0]?.sql).toContain('p.archived = 0');
    expect(
      queries.slice(1).every(({ values }) => values[0] === 'person-1'),
    ).toBe(true);
    expect(queries.some(({ values }) => values.includes('manipulado'))).toBe(
      false,
    );
  });

  it('rechaza una cuenta sin perfil activo', async () => {
    mocks.requireElder.mockResolvedValue({ id: 'elder-1', userType: 'elder' });
    mocks.getD1.mockReturnValue({
      prepare: () => ({
        bind() {
          return this;
        },
        first: async () => null,
      }),
    });

    const response = await GET(new Request('http://localhost/api/elder/data'));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('perfil activo'),
    });
  });
});
