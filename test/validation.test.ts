import { describe, expect, it, vi } from 'vitest';
import {
  appointmentSchema,
  backupSchema,
  medicationSchema,
  personSchema,
  taskSchema,
} from '@/lib/validation';

const personId = '11111111-1111-4111-8111-111111111111';
const recordId = '22222222-2222-4222-8222-222222222222';

describe('validaciones', () => {
  it('normaliza el perfil y rechaza fechas futuras', () => {
    expect(
      personSchema.parse({
        name: '  Ana Pérez ',
        birthDate: '1980-01-10',
        relationship: ' Madre ',
        notes: '  Control ',
      }),
    ).toEqual({
      name: 'Ana Pérez',
      birthDate: '1980-01-10',
      relationship: 'Madre',
      notes: 'Control',
    });
    vi.setSystemTime(new Date('2026-08-30T12:00:00Z'));
    expect(
      personSchema.safeParse({
        name: 'Ana',
        birthDate: '2027-01-01',
        relationship: 'Madre',
        notes: '',
      }).success,
    ).toBe(false);
    vi.useRealTimers();
  });

  it('exige todos los datos operativos de un turno', () => {
    expect(
      appointmentSchema.safeParse({
        specialty: '',
        doctor: '',
        date: '',
        time: '',
        place: '',
        bring: '',
      }).success,
    ).toBe(false);
  });

  it('acepta medicamento y pendiente válidos', () => {
    expect(
      medicationSchema.safeParse({
        name: 'Losartán',
        dose: '50 mg',
        frequency: 'Diario',
        doctor: 'Dra. Pérez',
        notes: '',
        active: true,
      }).success,
    ).toBe(true);
    expect(
      taskSchema.safeParse({
        title: 'Pedir receta',
        dueDate: '',
        priority: 'Normal',
        status: 'Pendiente',
        notes: '',
      }).success,
    ).toBe(true);
  });
});

describe('respaldo', () => {
  const valid = {
    schemaVersion: 1 as const,
    exportedAt: '2026-08-30T12:00:00.000Z',
    person: {
      id: personId,
      name: 'Ana',
      birthDate: '1980-01-10',
      relationship: 'Madre',
      notes: '',
    },
    appointments: [
      {
        id: recordId,
        personId,
        specialty: 'Clínica',
        doctor: 'Dra. Pérez',
        date: '2026-09-01',
        time: '10:00',
        place: 'Hospital',
        bring: 'DNI',
        notes: '',
        status: 'Próximo' as const,
      },
    ],
    medications: [],
    tasks: [],
  };

  it('acepta una copia íntegra versionada', () =>
    expect(backupSchema.safeParse(valid).success).toBe(true));
  it('rechaza versiones desconocidas', () =>
    expect(backupSchema.safeParse({ ...valid, schemaVersion: 2 }).success).toBe(
      false,
    ));
  it('rechaza registros asociados a otra persona', () =>
    expect(
      backupSchema.safeParse({
        ...valid,
        appointments: [
          {
            ...valid.appointments[0],
            personId: '33333333-3333-4333-8333-333333333333',
          },
        ],
      }).success,
    ).toBe(false));
  it('rechaza identificadores repetidos entre colecciones', () =>
    expect(
      backupSchema.safeParse({
        ...valid,
        tasks: [
          {
            id: recordId,
            personId,
            title: 'Duplicado',
            dueDate: '',
            priority: 'Normal',
            status: 'Pendiente',
            notes: '',
          },
        ],
      }).success,
    ).toBe(false));
});
