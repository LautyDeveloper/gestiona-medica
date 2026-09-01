import type {
  Alert,
  AlertPreferences,
  AlertState,
  AlertUrgency,
} from '@/lib/models';
import { ARGENTINA_TIME_ZONE } from '@/lib/elder-view';

export const DEFAULT_ALERT_PREFERENCES: AlertPreferences = {
  appointmentLeadMinutes: 1440,
  taskLeadDays: 0,
  documentLeadDays: 7,
};

export type AlertSource =
  | {
      kind: 'appointment';
      id: string;
      personId: string;
      personName: string;
      specialty: string;
      date: string;
      time: string;
      place: string;
    }
  | {
      kind: 'task';
      id: string;
      personId: string;
      personName: string;
      title: string;
      dueDate: string;
    }
  | {
      kind: 'order';
      id: string;
      personId: string;
      personName: string;
      specialty: string;
      expirationDate: string;
    }
  | {
      kind: 'prescription';
      id: string;
      personId: string;
      personName: string;
      medicationName: string;
      expirationDate: string;
    };

export type StoredAlertState = {
  alertKey: string;
  readAt: string | null;
  snoozedUntil: string | null;
};

function dateParts(now: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ARGENTINA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function dayNumber(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function appointmentInstant(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`);
}

function stateFor(
  stored: StoredAlertState | undefined,
  now: Date,
): Pick<Alert, 'state' | 'readAt' | 'snoozedUntil'> {
  if (stored?.snoozedUntil && stored.snoozedUntil > now.toISOString())
    return {
      state: 'snoozed',
      readAt: null,
      snoozedUntil: stored.snoozedUntil,
    };
  if (stored?.readAt)
    return { state: 'read', readAt: stored.readAt, snoozedUntil: null };
  return { state: 'active', readAt: null, snoozedUntil: null };
}

function urgencyForDate(value: string, today: string): AlertUrgency {
  if (value < today) return 'overdue';
  if (value === today) return 'today';
  return 'upcoming';
}

function makeAlert(
  source: AlertSource,
  stored: StoredAlertState | undefined,
  now: Date,
): Alert {
  const today = dateParts(now);
  if (source.kind === 'appointment') {
    const relevantAt = `${source.date}T${source.time}:00-03:00`;
    return {
      id: `${source.kind}:${source.id}:${source.date}T${source.time}`,
      kind: source.kind,
      entityId: source.id,
      personId: source.personId,
      personName: source.personName,
      title: `Turno de ${source.specialty}`,
      detail: `${source.date} a las ${source.time} · ${source.place}`,
      relevantAt,
      targetSection: 'appointments',
      urgency:
        appointmentInstant(source.date, source.time) < now
          ? 'overdue'
          : urgencyForDate(source.date, today),
      ...stateFor(stored, now),
    };
  }
  const relevantDate =
    source.kind === 'task' ? source.dueDate : source.expirationDate;
  const common = {
    id: `${source.kind}:${source.id}:${relevantDate}`,
    kind: source.kind,
    entityId: source.id,
    personId: source.personId,
    personName: source.personName,
    relevantAt: relevantDate,
    urgency: urgencyForDate(relevantDate, today),
    ...stateFor(stored, now),
  };
  if (source.kind === 'task')
    return {
      ...common,
      title: source.title,
      detail: `Fecha límite: ${source.dueDate}`,
      targetSection: 'tasks',
    };
  if (source.kind === 'order')
    return {
      ...common,
      title: `Orden de ${source.specialty}`,
      detail: `Vence: ${source.expirationDate}`,
      targetSection: 'orders',
    };
  return {
    ...common,
    title: `Receta de ${source.medicationName}`,
    detail: `Vence: ${source.expirationDate}`,
    targetSection: 'prescriptions',
  };
}

export function deriveAlerts({
  sources,
  preferences,
  states = [],
  now = new Date(),
}: {
  sources: AlertSource[];
  preferences: AlertPreferences;
  states?: StoredAlertState[];
  now?: Date;
}) {
  const today = dateParts(now);
  const todayNumber = dayNumber(today);
  const stateMap = new Map(states.map((state) => [state.alertKey, state]));
  const alerts = sources.flatMap((source) => {
    let included = false;
    if (source.kind === 'appointment') {
      if (preferences.appointmentLeadMinutes === -1) return [];
      const instant = appointmentInstant(source.date, source.time);
      included =
        instant <=
        new Date(now.getTime() + preferences.appointmentLeadMinutes * 60_000);
    } else {
      const relevantDate =
        source.kind === 'task' ? source.dueDate : source.expirationDate;
      const lead =
        source.kind === 'task'
          ? preferences.taskLeadDays
          : preferences.documentLeadDays;
      if (lead === -1 || !relevantDate) return [];
      included = dayNumber(relevantDate) <= todayNumber + lead;
    }
    if (!included) return [];
    const draft = makeAlert(source, undefined, now);
    return [makeAlert(source, stateMap.get(draft.id), now)];
  });
  const stateOrder: Record<AlertState, number> = {
    active: 0,
    snoozed: 1,
    read: 2,
  };
  const urgencyOrder: Record<AlertUrgency, number> = {
    overdue: 0,
    today: 1,
    upcoming: 2,
  };
  return alerts.sort(
    (a, b) =>
      stateOrder[a.state] - stateOrder[b.state] ||
      urgencyOrder[a.urgency] - urgencyOrder[b.urgency] ||
      a.relevantAt.localeCompare(b.relevantAt) ||
      a.personName.localeCompare(b.personName, 'es'),
  );
}

export function tomorrowInArgentina(now = new Date()) {
  const today = dateParts(now);
  const next = new Date((dayNumber(today) + 1) * 86_400_000);
  return `${next.toISOString().slice(0, 10)}T09:00:00-03:00`;
}
