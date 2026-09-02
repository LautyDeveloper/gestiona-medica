import { getD1 } from '@/db';
import type { AppUser } from '@/lib/models';
import { AuthError, requireUser } from '@/lib/server-auth';

export async function resolveMedicationPerson(
  request: Request,
  personId?: string,
  careGroupId?: string,
) {
  const user = await requireUser(request);
  const db = getD1();
  if (user.userType === 'elder') {
    const person = await db
      .prepare(
        `SELECT p.id, p.care_group_id AS careGroupId
         FROM person_access pa JOIN persons p ON p.id = pa.person_id
         WHERE pa.user_id = ? AND p.archived = 0`,
      )
      .bind(user.id)
      .first<{ id: string; careGroupId: string }>();
    if (!person || (personId && person.id !== personId))
      throw new AuthError('No tenés acceso a esta persona', 403);
    return { user, personId: person.id, careGroupId: person.careGroupId };
  }
  if (!personId || !careGroupId)
    throw new AuthError('Falta indicar la persona y el grupo', 400);
  const person = await db
    .prepare(
      `SELECT p.id FROM persons p JOIN memberships m
         ON m.care_group_id = p.care_group_id
       WHERE p.id = ? AND p.care_group_id = ? AND p.archived = 0
         AND m.user_id = ?`,
    )
    .bind(personId, careGroupId, user.id)
    .first();
  if (!person) throw new AuthError('No tenés acceso a esta persona', 403);
  return { user, personId, careGroupId };
}

export async function requireOwnedMedication(
  medicationId: string,
  personId: string,
) {
  const medication = await getD1()
    .prepare(
      `SELECT id, units_per_intake_milli AS unitsPerIntakeMilli,
         stock_quantity_milli AS stockQuantityMilli,
         reorder_threshold_milli AS reorderThresholdMilli,
         stock_cycle AS stockCycle, active, schedule_type AS scheduleType,
         start_date AS startDate, end_date AS endDate,
         interval_minutes AS intervalMinutes,
         interval_anchor_at AS intervalAnchorAt
       FROM medications WHERE id = ? AND person_id = ?`,
    )
    .bind(medicationId, personId)
    .first<{
      id: string;
      unitsPerIntakeMilli: number | null;
      stockQuantityMilli: number | null;
      reorderThresholdMilli: number | null;
      stockCycle: number;
      active: number;
      scheduleType: 'unstructured' | 'fixed_times' | 'interval' | 'as_needed';
      startDate: string;
      endDate: string;
      intervalMinutes: number | null;
      intervalAnchorAt: string;
    }>();
  if (!medication)
    throw new AuthError('El medicamento no pertenece a esta persona', 404);
  return medication;
}

export function recordedBy(user: AppUser) {
  return user.displayName || user.username;
}
