import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ALERT_PREFERENCES,
  deriveAlerts,
  type AlertSource,
} from '@/lib/alerts';

const person = {
  personId: '11111111-1111-4111-8111-111111111111',
  personName: 'María',
};

describe('alertas derivadas', () => {
  const now = new Date('2026-09-01T12:00:00-03:00');

  it('respeta los límites exactos por tipo e incluye vencidas', () => {
    const sources: AlertSource[] = [
      {
        kind: 'appointment',
        id: 'a1',
        ...person,
        specialty: 'Cardiología',
        date: '2026-09-02',
        time: '12:00',
        place: 'Hospital',
      },
      {
        kind: 'appointment',
        id: 'a2',
        ...person,
        specialty: 'Clínica',
        date: '2026-09-02',
        time: '12:01',
        place: 'Consultorio',
      },
      {
        kind: 'task',
        id: 't1',
        ...person,
        title: 'Pedir receta',
        dueDate: '2026-09-01',
      },
      {
        kind: 'task',
        id: 't2',
        ...person,
        title: 'Tarea vencida',
        dueDate: '2026-08-31',
      },
      {
        kind: 'order',
        id: 'o1',
        ...person,
        specialty: 'Neurología',
        expirationDate: '2026-09-08',
      },
      {
        kind: 'prescription',
        id: 'r1',
        ...person,
        medicationName: 'Losartán',
        expirationDate: '2026-09-09',
      },
    ];
    const alerts = deriveAlerts({
      sources,
      preferences: DEFAULT_ALERT_PREFERENCES,
      now,
    });
    expect(alerts.map((alert) => alert.entityId)).toEqual([
      't2',
      't1',
      'a1',
      'o1',
    ]);
    expect(alerts[0].urgency).toBe('overdue');
    expect(alerts[1].urgency).toBe('today');
  });

  it('conserva lectura si cambia texto y crea otra ocurrencia al cambiar fecha', () => {
    const source: AlertSource = {
      kind: 'task',
      id: 't1',
      ...person,
      title: 'Pedir receta actualizada',
      dueDate: '2026-09-01',
    };
    const read = deriveAlerts({
      sources: [source],
      preferences: DEFAULT_ALERT_PREFERENCES,
      states: [
        {
          alertKey: 'task:t1:2026-09-01',
          readAt: '2026-09-01T13:00:00.000Z',
          snoozedUntil: null,
        },
      ],
      now,
    });
    expect(read[0].state).toBe('read');
    const moved = deriveAlerts({
      sources: [{ ...source, dueDate: '2026-09-02' }],
      preferences: { ...DEFAULT_ALERT_PREFERENCES, taskLeadDays: 1 },
      states: [
        {
          alertKey: 'task:t1:2026-09-01',
          readAt: '2026-09-01T13:00:00.000Z',
          snoozedUntil: null,
        },
      ],
      now,
    });
    expect(moved[0]).toMatchObject({
      id: 'task:t1:2026-09-02',
      state: 'active',
    });
  });

  it('reactiva una alerta cuando termina su posposición y admite desactivar tipos', () => {
    const source: AlertSource = {
      kind: 'task',
      id: 't1',
      ...person,
      title: 'Pedir receta',
      dueDate: '2026-09-01',
    };
    expect(
      deriveAlerts({
        sources: [source],
        preferences: DEFAULT_ALERT_PREFERENCES,
        states: [
          {
            alertKey: 'task:t1:2026-09-01',
            readAt: null,
            snoozedUntil: '2026-09-01T16:00:00.000Z',
          },
        ],
        now,
      })[0].state,
    ).toBe('snoozed');
    expect(
      deriveAlerts({
        sources: [source],
        preferences: DEFAULT_ALERT_PREFERENCES,
        states: [
          {
            alertKey: 'task:t1:2026-09-01',
            readAt: null,
            snoozedUntil: '2026-09-01T14:00:00.000Z',
          },
        ],
        now,
      })[0].state,
    ).toBe('active');
    expect(
      deriveAlerts({
        sources: [source],
        preferences: { ...DEFAULT_ALERT_PREFERENCES, taskLeadDays: -1 },
        now,
      }),
    ).toEqual([]);
  });
});
