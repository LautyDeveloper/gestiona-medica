// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getD1: vi.fn() }));
vi.mock('@/db', () => ({ getD1: mocks.getD1 }));

import { createSession, requireUser } from '@/lib/server-auth';

function statement(sql: string, first?: () => unknown) {
  return {
    sql,
    values: [] as unknown[],
    bind(...values: unknown[]) {
      this.values = values;
      return this;
    },
    first: async () => first?.(),
    run: vi.fn(async () => ({ meta: { changes: 1 } })),
  };
}

type Statement = ReturnType<typeof statement>;

afterEach(() => {
  vi.useRealTimers();
  mocks.getD1.mockReset();
});

describe('mantenimiento de sesiones', () => {
  it('limpia sesiones vencidas y revocadas antiguas al crear una nueva', async () => {
    const batches: Statement[][] = [];
    const db = {
      prepare: (sql: string) => statement(sql),
      async batch(statements: Statement[]) {
        batches.push(statements);
        return statements.map(() => ({ meta: { changes: 1 } }));
      },
    };
    mocks.getD1.mockReturnValue(db);
    vi.setSystemTime(new Date('2026-08-31T12:00:00.000Z'));

    await createSession(new Request('https://cerca.example'), 'user-1');

    expect(batches).toHaveLength(1);
    expect(batches[0]?.[0]?.sql).toContain('expires_at <= ?');
    expect(batches[0]?.[0]?.sql).toContain('revoked_at <= ?');
    expect(batches[0]?.[1]?.sql).toContain('INSERT INTO sessions');
  });

  it('no actualiza last_seen_at cuando fue registrado recientemente', async () => {
    const updates: Statement[] = [];
    const db = {
      prepare(sql: string) {
        const prepared = statement(sql, () => ({
          id: 'user-1',
          username: 'ana',
          displayName: 'Ana',
          userType: 'caregiver',
          lastSeenAt: '2026-08-31T11:55:00.000Z',
        }));
        if (sql.startsWith('UPDATE users')) updates.push(prepared);
        return prepared;
      },
    };
    mocks.getD1.mockReturnValue(db);
    vi.setSystemTime(new Date('2026-08-31T12:00:00.000Z'));

    const user = await requireUser(
      new Request('https://cerca.example', {
        headers: { Cookie: 'cerca_session=token' },
      }),
    );

    expect(user).toMatchObject({ id: 'user-1', userType: 'caregiver' });
    expect(updates).toHaveLength(0);
  });

  it('actualiza last_seen_at con condición de concurrencia si está vencido', async () => {
    const updates: Statement[] = [];
    const db = {
      prepare(sql: string) {
        const prepared = statement(sql, () => ({
          id: 'user-1',
          username: 'ana',
          displayName: 'Ana',
          userType: 'caregiver',
          lastSeenAt: '2026-08-31T11:00:00.000Z',
        }));
        if (sql.startsWith('UPDATE users')) updates.push(prepared);
        return prepared;
      },
    };
    mocks.getD1.mockReturnValue(db);
    vi.setSystemTime(new Date('2026-08-31T12:00:00.000Z'));

    await requireUser(
      new Request('https://cerca.example', {
        headers: { Cookie: 'cerca_session=token' },
      }),
    );

    expect(updates).toHaveLength(1);
    expect(updates[0]?.sql).toContain('last_seen_at <= ?');
    expect(updates[0]?.run).toHaveBeenCalledOnce();
  });
});
