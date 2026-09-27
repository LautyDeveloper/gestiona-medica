import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(),
  requireMembership: vi.fn(),
}));

vi.mock('@/db', () => ({ getD1: mocks.getD1 }));
vi.mock('@/lib/server-auth', () => ({
  requireMembership: mocks.requireMembership,
  requireSameOrigin: () => {},
}));

import { POST } from '@/app/api/prescriptions/use/route';

const prescriptionId = '11111111-1111-4111-8111-111111111111';
const personId = '22222222-2222-4222-8222-222222222222';
const groupId = '33333333-3333-4333-8333-333333333333';
const medicationId = '44444444-4444-4444-8444-444444444444';

function request() {
  return new Request('http://localhost/api/prescriptions/use', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prescriptionId,
      personId,
      careGroupId: groupId,
      version: 2,
    }),
  });
}

function fakeDb(
  prescription: {
    status: 'pending' | 'used';
    expirationDate: string;
    medicationId: string | null;
    version: number;
  },
  changes = 1,
) {
  const executed: Array<{ sql: string; values: unknown[] }> = [];
  return {
    executed,
    prepare(sql: string) {
      const statement = {
        values: [] as unknown[],
        bind(...values: unknown[]) {
          this.values = values;
          return this;
        },
        first: async () => prescription,
        run: async () => {
          executed.push({ sql, values: statement.values });
          return { meta: { changes } };
        },
      };
      return statement;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  mocks.getD1.mockReset();
  mocks.requireMembership.mockReset();
});

describe('uso de recetas vinculadas', () => {
  it('marca la receta como utilizada sin modificar el medicamento', async () => {
    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
    const db = fakeDb({
      status: 'pending',
      expirationDate: '2026-09-30',
      medicationId,
      version: 2,
    });
    mocks.getD1.mockReturnValue(db);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(db.executed).toHaveLength(1);
    expect(db.executed[0]?.sql).toContain('UPDATE prescriptions');
    expect(db.executed[0]?.sql).not.toContain('UPDATE medications');
    expect(db.executed[0]?.values).toContain(medicationId);
  });

  it.each([
    [
      'utilizada',
      {
        status: 'used' as const,
        expirationDate: '2026-09-30',
        medicationId,
        version: 2,
      },
    ],
    [
      'vencida',
      {
        status: 'pending' as const,
        expirationDate: '2026-08-30',
        medicationId,
        version: 2,
      },
    ],
    [
      'sin medicamento',
      {
        status: 'pending' as const,
        expirationDate: '2026-09-30',
        medicationId: null,
        version: 2,
      },
    ],
    [
      'desactualizada',
      {
        status: 'pending' as const,
        expirationDate: '2026-09-30',
        medicationId,
        version: 3,
      },
    ],
  ])('rechaza una receta %s', async (_label, prescription) => {
    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
    const db = fakeDb(prescription);
    mocks.getD1.mockReturnValue(db);

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(db.executed).toHaveLength(0);
  });

  it('rechaza el vínculo si el medicamento ya no pertenece a la persona', async () => {
    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
    const db = fakeDb(
      {
        status: 'pending',
        expirationDate: '2026-09-30',
        medicationId,
        version: 2,
      },
      0,
    );
    mocks.getD1.mockReturnValue(db);

    const response = await POST(request());

    expect(response.status).toBe(409);
  });
});
