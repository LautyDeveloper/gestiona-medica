import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  requireUser: vi.fn(),
  loadAlertContextsForUser: vi.fn(),
}));

vi.mock('@/db', () => ({ getD1: () => ({ prepare: mocks.prepare, batch: vi.fn() }) }));
vi.mock('@/lib/server-auth', () => ({
  requireSameOrigin: vi.fn(),
  requireUser: mocks.requireUser,
  authError: (error: unknown) => {
    throw error;
  },
}));
vi.mock('@/lib/server-alerts', () => ({
  loadAlertContextsForUser: mocks.loadAlertContextsForUser,
}));

import { DELETE, POST } from '@/app/api/push/subscriptions/route';

function request(method: 'POST' | 'DELETE', body: unknown) {
  return new Request('https://cerca.example/api/push/subscriptions', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('suscripciones push', () => {
  it('registra y elimina solamente el dispositivo del usuario autenticado', async () => {
    mocks.requireUser.mockResolvedValue({
      id: 'u1',
      username: 'ana',
      displayName: 'Ana',
      userType: 'caregiver',
    });
    mocks.loadAlertContextsForUser.mockResolvedValue([]);
    const statements: string[] = [];
    mocks.prepare.mockImplementation((sql: string) => {
      statements.push(sql);
      const chain = {
        bind: vi.fn(() => chain),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      };
      return chain;
    });
    const subscription = {
      endpoint: 'https://push.example/device',
      keys: { p256dh: 'public-key', auth: 'auth-key' },
    };
    expect((await POST(request('POST', subscription))).status).toBe(200);
    expect((await DELETE(request('DELETE', { endpoint: subscription.endpoint }))).status).toBe(200);
    expect(statements.some((sql) => sql.includes('INSERT INTO push_subscriptions'))).toBe(true);
    expect(
      statements.some((sql) =>
        sql.includes('DELETE FROM push_subscriptions WHERE user_id = ?'),
      ),
    ).toBe(true);
  });
});
