import { describe, expect, it, vi } from 'vitest';
import {
  appointmentSchema,
  backupImportSchema,
  backupSchema,
  medicationSchema,
  personSchema,
  taskSchema,
} from '@/lib/validation';

const personId = '11111111-1111-4111-8111-111111111111';
const secondPersonId = '33333333-3333-4333-8333-333333333333';
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
  it('exige todos los datos operativos de un turno', () =>
    expect(
      appointmentSchema.safeParse({
        specialty: '',
        doctor: '',
        date: '',
        time: '',
        place: '',
        bring: '',
      }).success,
    ).toBe(false));
  it('acepta y normaliza horas de 24 horas y expresiones am/pm', () => {
    const appointment = {
      specialty: 'Cardiología',
      doctor: 'Dra. Pérez',
      date: '2026-09-07',
      place: 'Consultorio',
      bring: 'Estudios',
    };

    expect(appointmentSchema.parse({ ...appointment, time: '14' }).time).toBe(
      '14:00',
    );
    expect(
      appointmentSchema.parse({ ...appointment, time: '2 p. m.' }).time,
    ).toBe('14:00');
    expect(
      appointmentSchema.parse({ ...appointment, time: '12 am' }).time,
    ).toBe('00:00');
    expect(
      appointmentSchema.safeParse({ ...appointment, time: '25:00' }).success,
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

describe('respaldo multi-persona', () => {
  const appointment = {
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
  };
  const valid = {
    schemaVersion: 2 as const,
    exportedAt: '2026-08-30T12:00:00.000Z',
    persons: [
      {
        id: personId,
        name: 'Ana',
        birthDate: '1980-01-10',
        relationship: 'Madre',
        notes: '',
        archived: false,
      },
      {
        id: secondPersonId,
        name: 'Luis',
        birthDate: '1978-03-04',
        relationship: 'Padre',
        notes: '',
        archived: true,
      },
    ],
    appointments: [appointment],
    medications: [],
    tasks: [],
  };

  it('acepta una copia íntegra con perfiles activos y archivados', () =>
    expect(backupSchema.safeParse(valid).success).toBe(true));
  it('convierte respaldos de Sprint 1 a versión 3', () => {
    const legacy = {
      schemaVersion: 1,
      exportedAt: valid.exportedAt,
      person: {
        id: personId,
        name: 'Ana',
        birthDate: '1980-01-10',
        relationship: 'Madre',
        notes: '',
      },
      appointments: [appointment],
      medications: [],
      tasks: [],
    };
    const parsed = backupImportSchema.parse(legacy);
    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.persons).toEqual([{ ...legacy.person, archived: false }]);
  });
  it('rechaza versiones desconocidas', () =>
    expect(
      backupImportSchema.safeParse({ ...valid, schemaVersion: 99 }).success,
    ).toBe(false));
  it('rechaza registros asociados a personas inexistentes', () =>
    expect(
      backupSchema.safeParse({
        ...valid,
        appointments: [
          { ...appointment, personId: '44444444-4444-4444-8444-444444444444' },
        ],
      }).success,
    ).toBe(false));
  it('rechaza personas duplicadas', () =>
    expect(
      backupSchema.safeParse({
        ...valid,
        persons: [...valid.persons, valid.persons[0]],
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
  it('acepta respaldo versión 3 con metadatos del grupo', () =>
    expect(
      backupImportSchema.safeParse({
        ...valid,
        schemaVersion: 3,
        careGroup: { name: 'Familia Pérez' },
      }).success,
    ).toBe(true));
  it('rechaza referencias inválidas también en versión 3', () =>
    expect(
      backupImportSchema.safeParse({
        ...valid,
        schemaVersion: 3,
        careGroup: { name: 'Familia Pérez' },
        appointments: [
          { ...appointment, personId: '44444444-4444-4444-8444-444444444444' },
        ],
      }).success,
    ).toBe(false));
});
