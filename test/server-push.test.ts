import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  buildPushPayload: vi.fn(),
  loadAlertContextsForUser: vi.fn(),
  derivePushCandidates: vi.fn(),
  pushPayloadForCandidate: vi.fn(),
}));

vi.mock('@/lib/runtime-env', () => ({
  runtimeEnv: () => ({
    VAPID_PUBLIC_KEY: 'public',
    VAPID_PRIVATE_KEY: 'private',
    VAPID_SUBJECT: 'mailto:test@example.com',
  }),
}));
vi.mock('@block65/webcrypto-web-push', () => ({
  buildPushPayload: mocks.buildPushPayload,
}));
vi.mock('@/db', () => ({
  getD1: () => ({ prepare: mocks.prepare, batch: vi.fn() }),
}));
vi.mock('@/lib/server-alerts', () => ({
  loadAlertContextsForUser: mocks.loadAlertContextsForUser,
}));
vi.mock('@/lib/push-notifications', () => ({
  derivePushCandidates: mocks.derivePushCandidates,
  pushPayloadForCandidate: mocks.pushPayloadForCandidate,
}));

import { dispatchPushNotifications } from '@/lib/server-push';

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('entrega push', () => {
  it('elimina endpoints vencidos informados por el proveedor', async () => {
    const deleted: string[] = [];
    mocks.prepare.mockImplementation((sql: string) => {
      const chain = {
        bind: vi.fn(() => chain),
        all: vi.fn().mockResolvedValue({
          results: sql.includes('FROM push_subscriptions')
            ? [
                {
                  id: 's1',
                  userId: 'u1',
                  endpoint: 'https://push.example/device',
                  p256dh: 'public-key',
                  auth: 'auth-key',
                  username: 'ana',
                  displayName: 'Ana',
                  userType: 'caregiver',
                },
              ]
            : [],
        }),
        run: vi.fn().mockImplementation(async () => {
          if (sql.includes('DELETE FROM push_subscriptions')) deleted.push(sql);
          return { meta: { changes: 1 } };
        }),
      };
      return chain;
    });
    mocks.loadAlertContextsForUser.mockResolvedValue([{}]);
    mocks.derivePushCandidates.mockReturnValue([
      {
        alert: { id: 'task:t1:2026-09-19' },
        phase: 'initial',
        scheduledAt: '2026-09-19T03:00:00.000Z',
      },
    ]);
    mocks.pushPayloadForCandidate.mockReturnValue({ title: 'Pendiente' });
    mocks.buildPushPayload.mockResolvedValue({ method: 'POST' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 410 })));

    await expect(dispatchPushNotifications()).resolves.toMatchObject({ removed: 1 });
    expect(deleted).toHaveLength(1);
  });
});
