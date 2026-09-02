import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  batch: vi.fn(),
  prepare: vi.fn(),
  resolveMedicationPerson: vi.fn(),
  requireOwnedMedication: vi.fn(),
}));

vi.mock('@/db', () => ({
  getD1: () => ({ prepare: mocks.prepare, batch: mocks.batch }),
}));
vi.mock('@/lib/server-auth', () => ({ requireSameOrigin: vi.fn() }));
vi.mock('@/lib/server-medication-access', () => ({
  resolveMedicationPerson: mocks.resolveMedicationPerson,
  requireOwnedMedication: mocks.requireOwnedMedication,
  recordedBy: () => 'Ana',
}));

import { POST } from '@/app/api/medication-intakes/route';

function request() {
  return new Request('http://localhost/api/medication-intakes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      careGroupId: '33333333-3333-4333-8333-333333333333',
      data: {
        medicationId: '11111111-1111-4111-8111-111111111111',
        personId: '22222222-2222-4222-8222-222222222222',
        scheduledFor: '2026-09-02T11:00:00.000Z',
        reportedAt: '2026-09-02T11:05:00.000Z',
        status: 'taken',
        notes: '',
      },
    }),
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('API de tomas', () => {
  it('registra la toma y descuenta stock en un único batch', async () => {
    vi.setSystemTime(new Date('2026-09-02T11:10:00.000Z'));
    mocks.resolveMedicationPerson.mockResolvedValue({
      user: { id: 'u1', displayName: 'Ana', username: 'ana' },
      personId: '22222222-2222-4222-8222-222222222222',
    });
    mocks.requireOwnedMedication.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      unitsPerIntakeMilli: 500,
      stockQuantityMilli: 5000,
      active: 1,
      scheduleType: 'fixed_times',
      startDate: '2026-09-01',
      endDate: '',
      intervalMinutes: null,
      intervalAnchorAt: '',
    });
    const statements: Array<{ sql: string; values: unknown[] }> = [];
    mocks.prepare.mockImplementation((sql: string) => ({
      bind: (...values: unknown[]) => {
        if (sql.includes('FROM medication_schedule_times'))
          return { first: vi.fn().mockResolvedValue({ ok: 1 }) };
        const statement = { sql, values };
        statements.push(statement);
        return statement;
      },
    }));
    mocks.batch.mockResolvedValue([]);
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.batch).toHaveBeenCalledOnce();
    expect(
      statements.some((item) => item.sql.includes('stock_quantity_milli')),
    ).toBe(true);
    expect(
      statements.some(
        (item) => item.sql.includes("'intake'") && item.values.includes(-500),
      ),
    ).toBe(true);
  });

  it('rechaza una segunda carga para la misma ocurrencia', async () => {
    vi.setSystemTime(new Date('2026-09-02T11:10:00.000Z'));
    mocks.resolveMedicationPerson.mockResolvedValue({
      user: { id: 'u1', displayName: 'Ana', username: 'ana' },
      personId: '22222222-2222-4222-8222-222222222222',
    });
    mocks.requireOwnedMedication.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      unitsPerIntakeMilli: null,
      stockQuantityMilli: null,
      active: 1,
      scheduleType: 'fixed_times',
      startDate: '2026-09-01',
      endDate: '',
      intervalMinutes: null,
      intervalAnchorAt: '',
    });
    mocks.prepare.mockImplementation((sql: string) => ({
      bind: () =>
        sql.includes('FROM medication_schedule_times')
          ? { first: vi.fn().mockResolvedValue({ ok: 1 }) }
          : {},
    }));
    mocks.batch.mockRejectedValue(
      new Error('UNIQUE constraint failed: medication_intakes'),
    );
    const response = await POST(request());
    expect(response.status).toBe(409);
  });
});
