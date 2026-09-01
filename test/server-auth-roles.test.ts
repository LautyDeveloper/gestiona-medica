// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getD1: vi.fn() }));
vi.mock('@/db', () => ({ getD1: mocks.getD1 }));

import { requireElder, requireMembership } from '@/lib/server-auth';

afterEach(() => mocks.getD1.mockReset());

describe('autorización por tipo de cuenta', () => {
  it('impide que una cuenta elder use endpoints de cuidadores', async () => {
    const run = vi.fn();
    mocks.getD1.mockReturnValue({
      prepare(sql: string) {
        return {
          bind() {
            return this;
          },
          first: async () =>
            sql.includes('FROM sessions')
              ? {
                  id: 'elder-1',
                  username: 'maria',
                  displayName: 'María',
                  userType: 'elder',
                  lastSeenAt: '2000-01-01T00:00:00.000Z',
                }
              : null,
          run,
        };
      },
    });

    await expect(
      requireMembership(
        new Request('http://localhost', {
          headers: { cookie: 'cerca_session=token' },
        }),
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(run).toHaveBeenCalledOnce();
  });

  it('impide que una cuenta caregiver use el endpoint exclusivo del abuelo', async () => {
    mocks.getD1.mockReturnValue({
      prepare(sql: string) {
        return {
          bind() {
            return this;
          },
          first: async () =>
            sql.includes('FROM sessions')
              ? {
                  id: 'caregiver-1',
                  username: 'ana',
                  displayName: 'Ana',
                  userType: 'caregiver',
                  lastSeenAt: '2999-01-01T00:00:00.000Z',
                }
              : null,
          run: async () => ({ meta: { changes: 1 } }),
        };
      },
    });

    await expect(
      requireElder(
        new Request('http://localhost', {
          headers: { cookie: 'cerca_session=token' },
        }),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});
