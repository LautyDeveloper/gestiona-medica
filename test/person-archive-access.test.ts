import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(),
  requireMembership: vi.fn(),
}));

vi.mock('@/db', () => ({ getD1: mocks.getD1 }));
vi.mock('@/lib/server-auth', () => ({
  requireMembership: mocks.requireMembership,
  authError: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : 'Error' },
      { status: 500 },
    ),
}));

import { PATCH } from '@/app/api/person/archive/route';

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getD1.mockReset();
  mocks.requireMembership.mockReset();
});

describe('archivado de una persona con acceso', () => {
  it('archiva y elimina solamente la identidad elder vinculada', async () => {
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    mocks.getD1.mockReturnValue({
      prepare(sql: string) {
        return {
          sql,
          values: [] as unknown[],
          bind(...values: unknown[]) {
            this.values = values;
            return this;
          },
          first: async () => ({ userId: 'elder-1' }),
        };
      },
      async batch(batch: Array<{ sql: string; values: unknown[] }>) {
        statements.push(...batch);
        return batch.map(() => ({ meta: { changes: 1 } }));
      },
    });

    const response = await PATCH(
      new Request('http://localhost/api/person/archive', {
        method: 'PATCH',
        body: JSON.stringify({
          id: '22222222-2222-4222-8222-222222222222',
          careGroupId: '11111111-1111-4111-8111-111111111111',
          archived: true,
          version: 1,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(statements).toHaveLength(5);
    expect(statements[0]?.sql).toContain('UPDATE persons');
    expect(
      statements.some(({ sql }) => sql.includes('DELETE FROM persons')),
    ).toBe(false);
    expect(mocks.requireMembership).toHaveBeenLastCalledWith(
      expect.any(Request),
      '11111111-1111-4111-8111-111111111111',
      'admin',
    );
  });
});
