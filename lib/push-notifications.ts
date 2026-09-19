import {
  alertIdForSource,
  deriveAlerts,
  notificationScheduleForSource,
} from '@/lib/alerts';
import type { Alert } from '@/lib/models';
import type { AlertContext } from '@/lib/server-alerts';

export type PushCandidate = {
  alert: Alert;
  careGroupId: string;
  phase: string;
  scheduledAt: string;
};

export type PushPayload = {
  title: string;
  body: string;
  tag: string;
  url: string;
};

export function derivePushCandidates(
  context: AlertContext,
  now = new Date(),
): PushCandidate[] {
  const alerts = deriveAlerts({
    sources: context.sources,
    preferences: context.preferences,
    states: context.states,
    now,
  });
  const sourceByAlert = new Map(
    context.sources.map((source) => [alertIdForSource(source, now), source]),
  );
  const stateByAlert = new Map(
    context.states.map((state) => [state.alertKey, state]),
  );

  return alerts.flatMap((alert) => {
    if (alert.state !== 'active') return [];
    const stored = stateByAlert.get(alert.id);
    const source = sourceByAlert.get(alert.id);
    if (!source) return [];
    const snoozedUntil = stored?.snoozedUntil;
    const scheduledAt =
      snoozedUntil && snoozedUntil <= now.toISOString()
        ? snoozedUntil
        : notificationScheduleForSource(source, context.preferences, now);
    if (!scheduledAt || new Date(scheduledAt) > now) return [];
    return [
      {
        alert,
        careGroupId: context.careGroupId,
        phase:
          snoozedUntil && snoozedUntil <= now.toISOString()
            ? `snooze:${snoozedUntil}`
            : 'initial',
        scheduledAt,
      },
    ];
  });
}

function categoryTitle(alert: Alert) {
  if (alert.kind === 'appointment') return 'Recordatorio de turno';
  if (alert.kind === 'medication-dose') return 'Recordatorio de medicación';
  if (alert.kind === 'medication-stock') return 'Recordatorio de reposición';
  if (alert.kind === 'task') return 'Pendiente importante';
  if (alert.kind === 'order') return 'Orden próxima a vencer';
  return 'Receta próxima a vencer';
}

export function pushPayloadForCandidate(
  candidate: PushCandidate,
): PushPayload {
  const params = new URLSearchParams({
    section: 'alerts',
    alertId: candidate.alert.id,
    careGroupId: candidate.careGroupId,
    personId: candidate.alert.personId,
  });
  return {
    title: categoryTitle(candidate.alert),
    body: `Tenés un aviso para ${candidate.alert.personName}.`,
    tag: candidate.alert.id,
    url: `/?${params.toString()}`,
  };
}
