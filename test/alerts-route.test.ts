import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Alert } from '@/lib/models';

const mocks = vi.hoisted(() => ({
  alertsForRequest: vi.fn(),
  batch: vi.fn(),
  prepare: vi.fn(),
}));

vi.mock('@/lib/server-alerts', () => ({
  alertsForRequest: mocks.alertsForRequest,
}));
vi.mock('@/db', () => ({
  getD1: () => ({ prepare: mocks.prepare, batch: mocks.batch }),
}));

import { GET, PATCH } from '@/app/api/alerts/route';

const alert: Alert = {
  id: 'appointment:a1:2026-09-02T12:00',
  kind: 'appointment',
  entityId: 'a1',
  personId: 'p1',
  personName: 'María',
  title: 'Turno de Cardiología',
  detail: '2026-09-02 a las 12:00 · Hospital',
  relevantAt: '2026-09-02T12:00:00-03:00',
  targetSection: 'appointments',
  state: 'active',
  urgency: 'upcoming',
  readAt: null,
  snoozedUntil: null,
};

function request(body?: unknown) {
  return new Request('http://localhost/api/alerts?careGroupId=g1', {
    method: body ? 'PATCH' : 'GET',
    headers: body
      ? { 'Content-Type': 'application/json', Origin: 'http://localhost' }
      : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  mocks.alertsForRequest.mockReset();
  mocks.batch.mockReset();
  mocks.prepare.mockReset();
});

describe('API de alertas', () => {
  it('cuenta sólo alertas activas', async () => {
    mocks.alertsForRequest.mockResolvedValue({
      context: {},
      alerts: [alert, { ...alert, id: 'read', state: 'read' }],
    });
    const response = await GET(request());
    await expect(response.json()).resolves.toMatchObject({ unreadCount: 1 });
  });

  it('persiste la lectura exclusivamente para el usuario autenticado', async () => {
    mocks.alertsForRequest.mockResolvedValue({
      context: { user: { id: 'u1' } },
      alerts: [alert],
    });
    const statement = { bind: vi.fn().mockReturnValue({ query: 'bound' }) };
    mocks.prepare.mockReturnValue(statement);
    const response = await PATCH(
      request({ action: 'read', alertId: alert.id }),
    );
    expect(response.status).toBe(200);
    expect(statement.bind).toHaveBeenCalledWith(
      'u1',
      alert.id,
      expect.any(String),
      null,
      expect.any(String),
    );
    expect(mocks.batch).toHaveBeenCalledWith([{ query: 'bound' }]);
  });

  it('impide posponer un turno después de su horario', async () => {
    mocks.alertsForRequest.mockResolvedValue({
      context: { user: { id: 'u1' } },
      alerts: [alert],
    });
    vi.setSystemTime(new Date('2026-09-01T12:00:00-03:00'));
    const response = await PATCH(
      request({
        action: 'snooze',
        alertId: alert.id,
        until: '2026-09-03T09:00:00-03:00',
      }),
    );
    expect(response.status).toBe(400);
    vi.useRealTimers();
  });
});
