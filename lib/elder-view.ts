import type { Appointment } from '@/lib/models';

export const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';

function parts(now: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ARGENTINA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
}

export function argentinaDateTime(now = new Date()) {
  const value = parts(now);
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`;
}

export function fullArgentinaDate(now = new Date()) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ARGENTINA_TIME_ZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);
}

export function splitElderAppointments(
  appointments: Appointment[],
  now = new Date(),
) {
  const current = argentinaDateTime(now);
  const upcoming = appointments
    .filter(
      (item) =>
        item.status === 'Próximo' && `${item.date}T${item.time}` >= current,
    )
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const upcomingIds = new Set(upcoming.map((item) => item.id));
  const history = appointments
    .filter((item) => !upcomingIds.has(item.id))
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  return { upcoming, history };
}
