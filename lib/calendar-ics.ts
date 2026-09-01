import type { Appointment } from '@/lib/models';

export type CalendarAppointment = Pick<
  Appointment,
  'id' | 'specialty' | 'date' | 'time' | 'place'
> & { personName: string };

function escapeText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,');
}

function localDateTime(date: string, time: string) {
  return `${date.replaceAll('-', '')}T${time.replace(':', '')}00`;
}

function utcStamp(now: Date) {
  return now
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function foldLine(line: string) {
  const encoder = new TextEncoder();
  const folded: string[] = [];
  let current = '';
  for (const character of line) {
    if (encoder.encode(current + character).byteLength > 75) {
      folded.push(current);
      current = ` ${character}`;
    } else current += character;
  }
  folded.push(current);
  return folded;
}

export function appointmentsIcs(
  appointments: CalendarAppointment[],
  now = new Date(),
) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cerca//Agenda medica familiar//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Cerca - Turnos',
    'BEGIN:VTIMEZONE',
    'TZID:America/Argentina/Buenos_Aires',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0300',
    'TZOFFSETTO:-0300',
    'TZNAME:-03',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  for (const appointment of appointments) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:appointment-${appointment.id}@cerca`,
      `DTSTAMP:${utcStamp(now)}`,
      `DTSTART;TZID=America/Argentina/Buenos_Aires:${localDateTime(appointment.date, appointment.time)}`,
      `SUMMARY:${escapeText(`Turno de ${appointment.specialty} - ${appointment.personName}`)}`,
      `LOCATION:${escapeText(appointment.place)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.flatMap(foldLine).join('\r\n')}\r\n`;
}
