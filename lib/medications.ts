import type {
  Medication,
  MedicationIntake,
  MedicationOccurrence,
} from '@/lib/models';
import { ARGENTINA_TIME_ZONE } from '@/lib/elder-view';

export const STOCK_SCALE = 1000;

export function toStockMilli(value: number | null | undefined) {
  return value == null ? null : Math.round(value * STOCK_SCALE);
}

export function fromStockMilli(value: number | null | undefined) {
  return value == null ? null : value / STOCK_SCALE;
}

export function argentinaDate(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: ARGENTINA_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function argentinaLocalInstant(date: string, time: string) {
  return new Date(`${date}T${time}:00-03:00`);
}

function activeOnDate(medication: Medication, date: string) {
  return (
    medication.active &&
    (!medication.startDate || medication.startDate <= date) &&
    (!medication.endDate || medication.endDate >= date)
  );
}

function occurrenceStatus(
  scheduledFor: string,
  intake: MedicationIntake | undefined,
  now: Date,
): MedicationOccurrence['status'] {
  if (intake?.status === 'taken') return 'taken';
  if (intake?.status === 'not_taken') return 'not_taken';
  return new Date(scheduledFor) <= now ? 'unrecorded' : 'upcoming';
}

export function deriveMedicationOccurrences({
  medications,
  intakes = [],
  date,
  now = new Date(),
}: {
  medications: Medication[];
  intakes?: MedicationIntake[];
  date?: string;
  now?: Date;
}) {
  const targetDate = date || argentinaDate(now);
  const activeIntakes = intakes.filter((item) => !item.voidedAt);
  const bySchedule = new Map(
    activeIntakes
      .filter((item) => item.scheduledFor)
      .map((item) => [`${item.medicationId}:${item.scheduledFor}`, item]),
  );
  const occurrences: MedicationOccurrence[] = [];

  for (const medication of medications) {
    if (!activeOnDate(medication, targetDate)) continue;
    if (medication.scheduleType === 'as_needed') {
      occurrences.push({
        id: `as-needed:${medication.id}:${targetDate}`,
        medicationId: medication.id,
        medicationName: medication.name,
        dose: medication.dose,
        scheduledFor: null,
        status: 'as_needed',
        intake: null,
      });
      continue;
    }
    let instants: Date[] = [];
    if (medication.scheduleType === 'fixed_times')
      instants = medication.scheduleTimes.map((time) =>
        argentinaLocalInstant(targetDate, time),
      );
    if (
      medication.scheduleType === 'interval' &&
      medication.intervalMinutes &&
      medication.intervalAnchorAt
    ) {
      const anchor = new Date(`${medication.intervalAnchorAt}:00-03:00`);
      const start = argentinaLocalInstant(targetDate, '00:00');
      const end = new Date(start.getTime() + 86_400_000);
      const step = medication.intervalMinutes * 60_000;
      let cursor = anchor.getTime();
      if (cursor < start.getTime())
        cursor += Math.ceil((start.getTime() - cursor) / step) * step;
      for (; cursor < end.getTime(); cursor += step)
        instants.push(new Date(cursor));
    }
    for (const instant of instants.sort((a, b) => a.getTime() - b.getTime())) {
      const scheduledFor = instant.toISOString();
      const intake = bySchedule.get(`${medication.id}:${scheduledFor}`);
      occurrences.push({
        id: `dose:${medication.id}:${scheduledFor}`,
        medicationId: medication.id,
        medicationName: medication.name,
        dose: medication.dose,
        scheduledFor,
        status: occurrenceStatus(scheduledFor, intake, now),
        intake: intake || null,
      });
    }
  }
  return occurrences.sort((a, b) =>
    (a.scheduledFor || '9999').localeCompare(b.scheduledFor || '9999'),
  );
}

export function isLowStock(medication: Medication) {
  return (
    medication.stockQuantity !== null &&
    medication.reorderThreshold !== null &&
    medication.stockQuantity <= medication.reorderThreshold
  );
}
