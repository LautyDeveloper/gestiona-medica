import type { Medication, MedicationScheduleType } from '@/lib/models';
import { fromStockMilli } from '@/lib/medications';

export const MEDICATION_SELECT = `id, person_id AS personId, name, dose,
  frequency, doctor, notes, active, schedule_type AS scheduleType,
  start_date AS startDate, end_date AS endDate,
  interval_minutes AS intervalMinutes,
  interval_anchor_at AS intervalAnchorAt, presentation,
  stock_unit AS stockUnit, units_per_intake_milli AS unitsPerIntakeMilli,
  stock_quantity_milli AS stockQuantityMilli,
  reorder_threshold_milli AS reorderThresholdMilli,
  stock_cycle AS stockCycle, version`;

export type RawMedication = Omit<
  Medication,
  | 'active'
  | 'scheduleTimes'
  | 'unitsPerIntake'
  | 'stockQuantity'
  | 'reorderThreshold'
> & {
  active: number;
  scheduleType: MedicationScheduleType;
  unitsPerIntakeMilli: number | null;
  stockQuantityMilli: number | null;
  reorderThresholdMilli: number | null;
};

export type RawScheduleTime = {
  medicationId: string;
  localTime: string;
};

export function hydrateMedications(
  medications: RawMedication[],
  scheduleTimes: RawScheduleTime[],
) {
  const timesByMedication = new Map<string, string[]>();
  for (const item of scheduleTimes) {
    const values = timesByMedication.get(item.medicationId) || [];
    values.push(item.localTime);
    timesByMedication.set(item.medicationId, values);
  }
  return medications.map(
    ({
      unitsPerIntakeMilli,
      stockQuantityMilli,
      reorderThresholdMilli,
      ...item
    }): Medication => ({
      ...item,
      active: Boolean(item.active),
      scheduleTimes: timesByMedication.get(item.id) || [],
      unitsPerIntake: fromStockMilli(unitsPerIntakeMilli),
      stockQuantity: fromStockMilli(stockQuantityMilli),
      reorderThreshold: fromStockMilli(reorderThresholdMilli),
    }),
  );
}
