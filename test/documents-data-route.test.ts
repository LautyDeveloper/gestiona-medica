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

import { DELETE, PATCH, POST } from '@/app/api/data/route';

const personId = '11111111-1111-4111-8111-111111111111';
const groupId = '22222222-2222-4222-8222-222222222222';
const recordId = '33333333-3333-4333-8333-333333333333';

function fakeDb() {
  const executed: Array<{ sql: string; values: unknown[] }> = [];
  return {
    executed,
    prepare(sql: string) {
      const statement = {
        sql,
        values: [] as unknown[],
        bind(...values: unknown[]) {
          this.values = values;
          return this;
        },
        first: async () =>
          sql.includes('FROM persons')
            ? {
                id: personId,
                careGroupId: groupId,
                name: 'Abuela',
                birthDate: '1940-01-01',
                relationship: 'Abuela',
                notes: '',
                archived: 0,
                version: 1,
              }
            : { id: recordId },
        run: async () => {
          executed.push({ sql, values: statement.values });
          return { meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
}

function jsonRequest(method: string, body: unknown) {
  return new Request('http://localhost/api/data', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  mocks.getD1.mockReset();
  mocks.requireMembership.mockReset();
});

describe('CRUD de órdenes y recetas', () => {
  it('crea una orden pendiente para la persona autorizada', async () => {
    const db = fakeDb();
    mocks.getD1.mockReturnValue(db);
    const response = await POST(
      jsonRequest('POST', {
        entity: 'order',
        personId,
        careGroupId: groupId,
        data: {
          specialty: 'Cardiología',
          reason: 'Control',
          requestedBy: 'Dra. Pérez',
          issueDate: '2026-08-01',
          expirationDate: '2026-09-01',
          notes: '',
        },
      }),
    );

    expect(response.status).toBe(201);
    expect(db.executed[0]?.sql).toContain('INSERT INTO medical_orders');
    expect(db.executed[0]?.sql).toContain("'pending'");
  });

  it('edita una receta con control de versión', async () => {
    const db = fakeDb();
    mocks.getD1.mockReturnValue(db);
    const response = await PATCH(
      jsonRequest('PATCH', {
        entity: 'prescription',
        id: recordId,
        personId,
        careGroupId: groupId,
        data: {
          medicationName: 'Losartán',
          presentation: 'Comprimidos',
          dose: '50 mg',
          frequency: 'Diario',
          duration: '30 días',
          prescribedBy: 'Dra. Pérez',
          issueDate: '2026-08-01',
          expirationDate: '2026-09-01',
          notes: '',
          version: 2,
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(db.executed[0]?.sql).toContain('UPDATE prescriptions');
    expect(db.executed[0]?.values.at(-1)).toBe(2);
  });

  it('elimina solamente la orden asociada a la persona', async () => {
    const db = fakeDb();
    mocks.getD1.mockReturnValue(db);
    const response = await DELETE(
      new Request(
        `http://localhost/api/data?entity=order&id=${recordId}&personId=${personId}&careGroupId=${groupId}`,
        { method: 'DELETE' },
      ),
    );

    expect(response.status).toBe(200);
    expect(db.executed[0]?.sql).toContain('DELETE FROM medical_orders');
    expect(db.executed[0]?.values).toEqual([recordId, personId]);
  });
});
