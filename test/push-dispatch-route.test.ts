import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn() }));

vi.mock('@/lib/runtime-env', () => ({
  runtimeEnv: () => ({ NOTIFICATION_DISPATCH_SECRET: 'secret' }),
}));
vi.mock('@/lib/server-push', () => ({
  dispatchPushNotifications: mocks.dispatch,
}));

import { POST } from '@/app/api/internal/notifications/dispatch/route';

describe('despachador interno', () => {
  it('rechaza solicitudes sin el secreto compartido', async () => {
    const response = await POST(
      new Request('https://cerca.example/api/internal/notifications/dispatch', {
        method: 'POST',
      }),
    );
    expect(response.status).toBe(401);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});
