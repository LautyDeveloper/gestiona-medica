import { describe, expect, it } from 'vitest';
import {
  notificationScheduleForSource,
  DEFAULT_ALERT_PREFERENCES,
  type AlertSource,
} from '@/lib/alerts';
import {
  derivePushCandidates,
  pushPayloadForCandidate,
} from '@/lib/push-notifications';
import type { AlertContext } from '@/lib/server-alerts';

const person = {
  personId: '11111111-1111-4111-8111-111111111111',
  personName: 'María',
};

describe('programación de notificaciones push', () => {
  it('calcula anticipos de turnos, medicación y fechas en horario argentino', () => {
    expect(
      notificationScheduleForSource(
        {
          kind: 'appointment',
          id: 'a1',
          ...person,
          specialty: 'Cardiología',
          date: '2026-09-20',
          time: '10:30',
          place: 'Hospital',
        },
        DEFAULT_ALERT_PREFERENCES,
      ),
    ).toBe('2026-09-19T13:30:00.000Z');
    expect(
      notificationScheduleForSource(
        {
          kind: 'medication-dose',
          id: 'm1',
          ...person,
          medicationName: 'Losartán',
          dose: '1 comprimido',
          scheduledFor: '2026-09-19T15:00:00.000Z',
        },
        { ...DEFAULT_ALERT_PREFERENCES, medicationLeadMinutes: 30 },
      ),
    ).toBe('2026-09-19T14:30:00.000Z');
    expect(
      notificationScheduleForSource(
        {
          kind: 'task',
          id: 't1',
          ...person,
          title: 'Pedir receta',
          dueDate: '2026-09-20',
        },
        { ...DEFAULT_ALERT_PREFERENCES, taskLeadDays: 1 },
      ),
    ).toBe('2026-09-19T00:00:00-03:00');
  });

  it('crea una fase nueva al vencer una posposición', () => {
    const source: AlertSource = {
      kind: 'task',
      id: 't1',
      ...person,
      title: 'Pedir receta',
      dueDate: '2026-09-19',
    };
    const context: AlertContext = {
      user: {
        id: 'u1',
        username: 'maria',
        displayName: 'María',
        userType: 'caregiver',
      },
      careGroupId: 'g1',
      personId: null,
      preferences: DEFAULT_ALERT_PREFERENCES,
      sources: [source],
      states: [
        {
          alertKey: 'task:t1:2026-09-19',
          readAt: null,
          snoozedUntil: '2026-09-19T15:00:00.000Z',
        },
      ],
    };
    const candidates = derivePushCandidates(
      context,
      new Date('2026-09-19T15:01:00.000Z'),
    );
    expect(candidates[0]).toMatchObject({
      phase: 'snooze:2026-09-19T15:00:00.000Z',
      scheduledAt: '2026-09-19T15:00:00.000Z',
    });
  });

  it('omite los detalles médicos de la pantalla bloqueada', () => {
    const source: AlertSource = {
      kind: 'medication-dose',
      id: 'm1',
      ...person,
      medicationName: 'Losartán',
      dose: '1 comprimido',
      scheduledFor: '2026-09-19T15:00:00.000Z',
    };
    const context: AlertContext = {
      user: {
        id: 'u1',
        username: 'maria',
        displayName: 'María',
        userType: 'elder',
      },
      careGroupId: 'g1',
      personId: person.personId,
      preferences: DEFAULT_ALERT_PREFERENCES,
      sources: [source],
      states: [],
    };
    const candidate = derivePushCandidates(
      context,
      new Date('2026-09-19T15:00:00.000Z'),
    )[0];
    const payload = pushPayloadForCandidate(candidate);
    expect(payload).toMatchObject({
      title: 'Recordatorio de medicación',
      body: 'Tenés un aviso para María.',
    });
    expect(JSON.stringify(payload)).not.toContain('Losartán');
    expect(JSON.stringify(payload)).not.toContain('comprimido');
  });
});
