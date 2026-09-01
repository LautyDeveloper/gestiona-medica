import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(),
  requireMembership: vi.fn(),
}));

vi.mock('@/db', () => ({ getD1: mocks.getD1 }));
vi.mock('@/lib/server-auth', () => ({
  requireMembership: mocks.requireMembership,
  requireSameOrigin: () => {},
  authError: () => Response.json({ error: 'Auth' }, { status: 401 }),
}));

import { POST } from '@/app/api/backup/route';

const groupId = '11111111-1111-4111-8111-111111111111';
const personId = '22222222-2222-4222-8222-222222222222';

function backup(appointmentCount = 1) {
  return {
    schemaVersion: 4,
    exportedAt: '2026-08-31T12:00:00.000Z',
    careGroup: { name: 'Familia' },
    persons: [
      {
        id: personId,
        name: 'María',
        birthDate: '1940-05-12',
        relationship: 'Abuela',
        notes: '',
        archived: false,
      },
    ],
    appointments: Array.from({ length: appointmentCount }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      personId,
      specialty: 'Cardiología',
      doctor: 'Dra. Pérez',
      date: '2026-09-01',
      time: '10:00',
      place: 'Hospital',
      bring: 'DNI',
      notes: '',
      status: 'Próximo',
    })),
    orders: [],
    medications: [],
    prescriptions: [],
    tasks: [],
  };
}

function database({ fail = false } = {}) {
  const batches: Array<Array<{ sql: string; values: unknown[] }>> = [];
  return {
    batches,
    db: {
      prepare(sql: string) {
        return {
          sql,
          values: [] as unknown[],
          bind(...values: unknown[]) {
            this.values = values;
            return this;
          },
        };
      },
      async batch(statements: Array<{ sql: string; values: unknown[] }>) {
        batches.push(statements);
        if (fail) throw new Error('simulated transaction failure');
        return statements.map(() => ({ meta: { changes: 1 } }));
      },
    },
  };
}

function request(body: string) {
  return new Request(`http://localhost/api/backup?careGroupId=${groupId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getD1.mockReset();
  mocks.requireMembership.mockReset();
});

describe('restauración de respaldos', () => {
  it('envía borrado e inserción en un único batch atómico', async () => {
    const { db, batches } = database();
    mocks.getD1.mockReturnValue(db);

    const response = await POST(request(JSON.stringify(backup())));

    expect(response.status).toBe(200);
    expect(batches).toHaveLength(1);
    expect(batches[0]?.[0]?.sql).toContain('DELETE FROM sessions');
    expect(batches[0]?.some(({ sql }) => sql.includes('FROM json_each'))).toBe(
      true,
    );
  });

  it('mantiene acotada la cantidad de consultas para respaldos grandes', async () => {
    const { db, batches } = database();
    mocks.getD1.mockReturnValue(db);

    const response = await POST(request(JSON.stringify(backup(1000))));

    expect(response.status).toBe(200);
    expect(batches[0]?.length).toBeLessThan(20);
  });

  it('rechaza más de 5 MB aunque no se envíe Content-Length', async () => {
    const { db, batches } = database();
    mocks.getD1.mockReturnValue(db);
    const oversized = JSON.stringify({ padding: 'x'.repeat(5_000_001) });

    const response = await POST(request(oversized));

    expect(response.status).toBe(413);
    expect(batches).toHaveLength(0);
  });

  it('rechaza referencias cruzadas inválidas antes de modificar datos', async () => {
    const { db, batches } = database();
    mocks.getD1.mockReturnValue(db);
    const invalid = backup();
    invalid.appointments[0]!.personId = groupId;

    const response = await POST(request(JSON.stringify(invalid)));

    expect(response.status).toBe(400);
    expect(batches).toHaveLength(0);
  });

  it('informa que no hubo cambios si falla el batch transaccional', async () => {
    const { db, batches } = database({ fail: true });
    mocks.getD1.mockReturnValue(db);

    const response = await POST(request(JSON.stringify(backup())));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('no fueron modificados'),
    });
    expect(batches).toHaveLength(1);
  });
});
