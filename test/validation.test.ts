import { describe, expect, it, vi } from 'vitest';
import {
  appointmentSchema,
  backupImportSchema,
  backupSchema,
  medicationSchema,
  orderSchema,
  personSchema,
  prescriptionSchema,
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
  it('rechaza fechas de calendario imposibles en todos los registros', () => {
    expect(
      personSchema.safeParse({
        name: 'Ana',
        birthDate: '2025-02-29',
        relationship: 'Madre',
        notes: '',
      }).success,
    ).toBe(false);
    expect(
      appointmentSchema.safeParse({
        specialty: 'Cardiología',
        doctor: 'Dra. Pérez',
        date: '2026-02-31',
        time: '10:00',
        place: 'Hospital',
        bring: 'DNI',
        notes: '',
      }).success,
    ).toBe(false);
    expect(
      orderSchema.safeParse({
        specialty: 'Cardiología',
        reason: 'Control',
        requestedBy: 'Dra. Pérez',
        issueDate: '2026-13-01',
        expirationDate: '2027-01-01',
        notes: '',
      }).success,
    ).toBe(false);
    expect(
      prescriptionSchema.safeParse({
        medicationName: 'Losartán',
        presentation: 'Comprimidos',
        dose: '50 mg',
        frequency: 'Diario',
        duration: '30 días',
        prescribedBy: 'Dra. Pérez',
        issueDate: '2026-01-01',
        expirationDate: '2026-04-31',
        notes: '',
      }).success,
    ).toBe(false);
    expect(
      taskSchema.safeParse({
        title: 'Pedir receta',
        dueDate: '2026-99-01',
        priority: 'Normal',
        status: 'Pendiente',
        notes: '',
      }).success,
    ).toBe(false);
  });
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
  it('valida órdenes y recetas con vencimiento posterior a la emisión', () => {
    const dates = { issueDate: '2026-08-01', expirationDate: '2026-09-01' };
    expect(
      orderSchema.safeParse({
        specialty: 'Cardiología',
        reason: 'Control',
        requestedBy: 'Dra. Pérez',
        notes: '',
        ...dates,
      }).success,
    ).toBe(true);
    expect(
      prescriptionSchema.safeParse({
        medicationName: 'Losartán',
        presentation: 'Comprimidos de 50 mg',
        dose: '50 mg',
        frequency: 'Una vez por día',
        duration: '30 días',
        prescribedBy: 'Dra. Pérez',
        notes: '',
        ...dates,
      }).success,
    ).toBe(true);
    expect(
      orderSchema.safeParse({
        specialty: 'Cardiología',
        reason: 'Control',
        requestedBy: 'Dra. Pérez',
        notes: '',
        issueDate: '2026-09-01',
        expirationDate: '2026-08-01',
      }).success,
    ).toBe(false);
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
  it('convierte respaldos de Sprint 1 a versión 5', () => {
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
    expect(parsed.schemaVersion).toBe(5);
    expect(parsed.persons).toEqual([{ ...legacy.person, archived: false }]);
    expect(parsed.orders).toEqual([]);
    expect(parsed.prescriptions).toEqual([]);
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
  it('acepta respaldo versión 4 con documentos vinculados', () =>
    expect(
      backupImportSchema.safeParse({
        ...valid,
        schemaVersion: 4,
        careGroup: { name: 'Familia Pérez' },
        orders: [
          {
            id: '55555555-5555-4555-8555-555555555555',
            personId,
            specialty: 'Clínica',
            reason: 'Control',
            requestedBy: 'Dra. Pérez',
            issueDate: '2026-08-01',
            expirationDate: '2026-09-01',
            notes: '',
            status: 'used',
            appointmentId: recordId,
            usedAt: '2026-08-15T12:00:00.000Z',
          },
        ],
        prescriptions: [],
      }).success,
    ).toBe(true));
});
