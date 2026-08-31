import { describe, expect, it } from 'vitest';
import { argentinaDateTime, splitElderAppointments } from '@/lib/elder-view';
import type { Appointment } from '@/lib/models';

const base = {
  personId: 'p1',
  specialty: 'Clínica',
  doctor: 'Dra. Ana',
  place: 'Consultorio',
  bring: 'DNI',
  notes: '',
  status: 'Próximo' as const,
};

function appointment(id: string, date: string, time: string): Appointment {
  return { ...base, id, date, time };
}

describe('agenda temporal del abuelo', () => {
  it('interpreta la fecha y hora en Buenos Aires', () => {
    expect(argentinaDateTime(new Date('2026-09-01T02:30:00Z'))).toBe(
      '2026-08-31T23:30',
    );
  });

  it('incluye el minuto actual y ordena los turnos futuros', () => {
    const now = new Date('2026-09-01T02:30:00Z');
    const result = splitElderAppointments(
      [
        appointment('later', '2026-09-01', '09:00'),
        appointment('past', '2026-08-31', '23:29'),
        appointment('now', '2026-08-31', '23:30'),
      ],
      now,
    );

    expect(result.upcoming.map(({ id }) => id)).toEqual(['now', 'later']);
    expect(result.history.map(({ id }) => id)).toEqual(['past']);
  });

  it('trata realizados y cancelados como antecedentes aunque sean futuros', () => {
    const items = [
      {
        ...appointment('done', '2026-09-10', '10:00'),
        status: 'Realizado' as const,
      },
      {
        ...appointment('cancelled', '2026-09-11', '10:00'),
        status: 'Cancelado' as const,
      },
    ];
    const result = splitElderAppointments(
      items,
      new Date('2026-09-01T15:00:00Z'),
    );
    expect(result.upcoming).toHaveLength(0);
    expect(result.history).toHaveLength(2);
  });
});
