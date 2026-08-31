import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getD1: vi.fn(),
  requireMembership: vi.fn(),
}));

vi.mock('@/db', () => ({ getD1: mocks.getD1 }));
vi.mock('@/lib/server-auth', () => ({
  requireMembership: mocks.requireMembership,
  authError: () => Response.json({ error: 'Auth' }, { status: 401 }),
}));

import { POST } from '@/app/api/data/convert/route';

const personId = '11111111-1111-4111-8111-111111111111';
const groupId = '22222222-2222-4222-8222-222222222222';
const sourceId = '33333333-3333-4333-8333-333333333333';

function request(sourceEntity: 'order' | 'prescription', data: unknown) {
  return new Request('http://localhost/api/data/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceEntity,
      sourceId,
      personId,
      careGroupId: groupId,
      version: 1,
      data,
    }),
  });
}

function fakeDb(source: {
  status: 'pending' | 'used';
  expirationDate: string;
  version: number;
}) {
  const batched: Array<{ sql: string; values: unknown[] }> = [];
  return {
    batched,
    prepare(sql: string) {
      return {
        sql,
        values: [] as unknown[],
        bind(...values: unknown[]) {
          this.values = values;
          return this;
        },
        first: async () =>
          sql.includes('FROM persons') ? { id: personId } : source,
      };
    },
    async batch(statements: Array<{ sql: string; values: unknown[] }>) {
      batched.push(...statements);
      return statements.map(() => ({ meta: { changes: 1 } }));
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  mocks.getD1.mockReset();
  mocks.requireMembership.mockReset();
});

describe('conversión de documentos', () => {
  it('crea y vincula un turno de manera atómica', async () => {
    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
    const db = fakeDb({
      status: 'pending',
      expirationDate: '2026-09-30',
      version: 1,
    });
    mocks.getD1.mockReturnValue(db);

    const response = await POST(
      request('order', {
        specialty: 'Cardiología',
        doctor: 'Dra. Pérez',
        date: '2026-09-10',
        time: '14:00',
        place: 'Hospital',
        bring: 'Orden médica',
        notes: '',
        status: 'Próximo',
      }),
    );

    expect(response.status).toBe(201);
    expect(db.batched[0]?.sql).toContain('INSERT INTO appointments');
    expect(db.batched[1]?.sql).toContain("SET status = 'used'");
  });

  it('bloquea documentos vencidos o ya utilizados', async () => {
    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
    mocks.getD1.mockReturnValue(
      fakeDb({
        status: 'pending',
        expirationDate: '2026-08-30',
        version: 1,
      }),
    );
    const expired = await POST(request('order', {}));
    expect(expired.status).toBe(409);

    mocks.getD1.mockReturnValue(
      fakeDb({ status: 'used', expirationDate: '2026-09-30', version: 1 }),
    );
    const used = await POST(request('prescription', {}));
    expect(used.status).toBe(409);
  });

  it('crea y vincula un medicamento desde una receta', async () => {
    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
    const db = fakeDb({
      status: 'pending',
      expirationDate: '2026-09-30',
      version: 1,
    });
    mocks.getD1.mockReturnValue(db);

    const response = await POST(
      request('prescription', {
        name: 'Losartán',
        dose: '50 mg',
        frequency: 'Una vez por día',
        doctor: 'Dra. Pérez',
        notes: 'Presentación: comprimidos. Duración: 30 días.',
        active: true,
      }),
    );

    expect(response.status).toBe(201);
    expect(db.batched[0]?.sql).toContain('INSERT INTO medications');
    expect(db.batched[1]?.sql).toContain('UPDATE prescriptions');
  });
});
