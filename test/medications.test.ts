import { describe, expect, it } from 'vitest';
import type { Medication, MedicationIntake } from '@/lib/models';
import {
  deriveMedicationOccurrences,
  fromStockMilli,
  isLowStock,
  toStockMilli,
} from '@/lib/medications';

function medication(overrides: Partial<Medication> = {}): Medication {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    personId: '22222222-2222-4222-8222-222222222222',
    name: 'Losartán',
    dose: '50 mg',
    frequency: 'Una vez por día',
    doctor: 'Dra. Pérez',
    notes: '',
    active: true,
    scheduleType: 'fixed_times',
    scheduleTimes: ['08:00', '20:00'],
    startDate: '2026-09-01',
    endDate: '',
    intervalMinutes: null,
    intervalAnchorAt: '',
    presentation: 'Caja',
    stockUnit: 'comprimidos',
    unitsPerIntake: 1,
    stockQuantity: 10,
    reorderThreshold: 3,
    stockCycle: 1,
    ...overrides,
  };
}

describe('dominio de medicación', () => {
  it('genera horarios fijos y usa el estado neutral sin registrar', () => {
    const occurrences = deriveMedicationOccurrences({
      medications: [medication()],
      date: '2026-09-02',
      now: new Date('2026-09-02T12:00:00Z'),
    });
    expect(occurrences).toHaveLength(2);
    expect(occurrences.map((item) => item.status)).toEqual([
      'unrecorded',
      'upcoming',
    ]);
    expect(occurrences[0].scheduledFor).toBe('2026-09-02T11:00:00.000Z');
  });

  it('calcula intervalos al cruzar medianoche argentina', () => {
    const occurrences = deriveMedicationOccurrences({
      medications: [
        medication({
          scheduleType: 'interval',
          scheduleTimes: [],
          intervalMinutes: 480,
          intervalAnchorAt: '2026-09-01T20:00',
        }),
      ],
      date: '2026-09-02',
      now: new Date('2026-09-02T00:00:00Z'),
    });
    expect(
      occurrences.map((item) =>
        new Intl.DateTimeFormat('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }).format(new Date(item.scheduledFor!)),
      ),
    ).toEqual(['04:00', '12:00', '20:00']);
  });

  it('no programa tomas según necesidad y respeta inicio y fin', () => {
    const asNeeded = deriveMedicationOccurrences({
      medications: [
        medication({ scheduleType: 'as_needed', scheduleTimes: [] }),
      ],
      date: '2026-09-02',
    });
    expect(asNeeded).toMatchObject([
      { scheduledFor: null, status: 'as_needed' },
    ]);
    expect(
      deriveMedicationOccurrences({
        medications: [medication({ endDate: '2026-09-01' })],
        date: '2026-09-02',
      }),
    ).toEqual([]);
  });

  it('une una toma informada sin convertirla en garantía clínica', () => {
    const scheduledFor = '2026-09-02T11:00:00.000Z';
    const intake: MedicationIntake = {
      id: '33333333-3333-4333-8333-333333333333',
      medicationId: medication().id,
      personId: medication().personId,
      scheduledFor,
      reportedAt: scheduledFor,
      status: 'taken',
      notes: '',
      recordedByName: 'Ana',
      createdAt: scheduledFor,
      voidedAt: null,
    };
    const result = deriveMedicationOccurrences({
      medications: [medication({ scheduleTimes: ['08:00'] })],
      intakes: [intake],
      date: '2026-09-02',
    });
    expect(result[0]).toMatchObject({ status: 'taken', intake });
  });

  it('conserva cantidades fraccionarias y detecta reposición', () => {
    expect(toStockMilli(0.5)).toBe(500);
    expect(fromStockMilli(2500)).toBe(2.5);
    expect(isLowStock(medication({ stockQuantity: 3 }))).toBe(true);
    expect(isLowStock(medication({ stockQuantity: 3.001 }))).toBe(false);
  });
});
