import { describe, expect, it } from 'vitest';
import { appointmentsIcs } from '@/lib/calendar-ics';

describe('exportación de calendario', () => {
  it('genera eventos estables, privados y compatibles con la zona argentina', () => {
    const ics = appointmentsIcs(
      [
        {
          id: 'appointment-1',
          personName: 'María, Elena',
          specialty: 'Clínica; control',
          date: '2026-09-07',
          time: '14:30',
          place: 'Hospital Central',
        },
      ],
      new Date('2026-09-01T12:00:00.000Z'),
    );
    expect(ics).toContain('TZID:America/Argentina/Buenos_Aires\r\n');
    expect(ics).toContain(
      'DTSTART;TZID=America/Argentina/Buenos_Aires:20260907T143000',
    );
    expect(ics).toContain('UID:appointment-appointment-1@cerca');
    expect(ics).toContain(
      'SUMMARY:Turno de Clínica\\; control - María\\, Elena',
    );
    expect(ics).toContain('LOCATION:Hospital Central');
    expect(ics).not.toContain('DTEND');
    expect(ics).not.toContain('VALARM');
    expect(ics).not.toContain('\n\n');
    expect(ics.endsWith('\r\n')).toBe(true);
  });
});
