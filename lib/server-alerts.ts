import { getD1 } from '@/db';
import {
  DEFAULT_ALERT_PREFERENCES,
  deriveAlerts,
  type AlertSource,
  type StoredAlertState,
} from '@/lib/alerts';
import type { AlertPreferences, AppUser } from '@/lib/models';
import type { MedicationIntake } from '@/lib/models';
import { AuthError, requireUser } from '@/lib/server-auth';
import {
  argentinaDate,
  argentinaLocalInstant,
  deriveMedicationOccurrences,
  isLowStock,
} from '@/lib/medications';
import {
  hydrateMedications,
  MEDICATION_SELECT,
  type RawMedication,
  type RawScheduleTime,
} from '@/lib/server-medications';

type AlertContext = {
  user: AppUser;
  careGroupId: string;
  personId: string | null;
  preferences: AlertPreferences;
  sources: AlertSource[];
  states: StoredAlertState[];
};

async function resolveScope(request: Request, requestedGroupId?: string) {
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
    if (!person)
      throw new AuthError(
        'Esta cuenta no tiene un perfil activo asociado',
        403,
      );
    return { user, careGroupId: person.careGroupId, personId: person.id };
  }
  if (!requestedGroupId) throw new AuthError('Falta indicar el grupo', 400);
  const membership = await db
    .prepare(
      'SELECT 1 FROM memberships WHERE user_id = ? AND care_group_id = ?',
    )
    .bind(user.id, requestedGroupId)
    .first();
  if (!membership) throw new AuthError('No tenés acceso a este grupo', 403);
  return { user, careGroupId: requestedGroupId, personId: null };
}

async function loadSources(
  user: AppUser,
  careGroupId: string,
  personId: string | null,
) {
  const db = getD1();
  const personWhere = personId
    ? 'p.id = ?'
    : 'p.care_group_id = ? AND p.archived = 0';
  const value = personId || careGroupId;
  const [appointments, tasks, orders, prescriptions, medicationSources] =
    await Promise.all([
      db
        .prepare(
          `SELECT 'appointment' AS kind, a.id, a.person_id AS personId,
           p.name AS personName, a.specialty, a.date, a.time, a.place
         FROM appointments a JOIN persons p ON p.id = a.person_id
         WHERE ${personWhere} AND a.status = 'Próximo'`,
        )
        .bind(value)
        .all<Extract<AlertSource, { kind: 'appointment' }>>(),
      db
        .prepare(
          `SELECT 'task' AS kind, t.id, t.person_id AS personId,
           p.name AS personName, t.title, t.due_date AS dueDate
         FROM tasks t JOIN persons p ON p.id = t.person_id
         WHERE ${personWhere} AND t.status = 'Pendiente' AND t.due_date <> ''
           ${user.userType === 'elder' ? 'AND t.visible_to_elder = 1' : ''}`,
        )
        .bind(value)
        .all<Extract<AlertSource, { kind: 'task' }>>(),
      user.userType === 'elder'
        ? Promise.resolve({ results: [] as AlertSource[] })
        : db
            .prepare(
              `SELECT 'order' AS kind, o.id, o.person_id AS personId,
               p.name AS personName, o.specialty,
               o.expiration_date AS expirationDate
             FROM medical_orders o JOIN persons p ON p.id = o.person_id
             WHERE ${personWhere} AND o.status = 'pending'`,
            )
            .bind(value)
            .all<Extract<AlertSource, { kind: 'order' }>>(),
      user.userType === 'elder'
        ? Promise.resolve({ results: [] as AlertSource[] })
        : db
            .prepare(
              `SELECT 'prescription' AS kind, r.id, r.person_id AS personId,
               p.name AS personName, r.medication_name AS medicationName,
               r.expiration_date AS expirationDate
             FROM prescriptions r JOIN persons p ON p.id = r.person_id
             WHERE ${personWhere} AND r.status = 'pending'`,
            )
            .bind(value)
            .all<Extract<AlertSource, { kind: 'prescription' }>>(),
      loadMedicationSources(personWhere, value),
    ]);
  return [
    ...appointments.results,
    ...tasks.results,
    ...orders.results,
    ...prescriptions.results,
    ...medicationSources,
  ] as AlertSource[];
}

async function loadMedicationSources(personWhere: string, value: string) {
  const db = getD1();
  const today = argentinaDate();
  const intakeStart = argentinaLocalInstant(today, '00:00');
  const intakeEnd = new Date(intakeStart.getTime() + 2 * 86_400_000);
  const [rawMedications, times, intakes] = await Promise.all([
    db
      .prepare(
        `SELECT m.*, p.name AS personName
         FROM (SELECT ${MEDICATION_SELECT} FROM medications) m
         JOIN persons p ON p.id = m.personId
         WHERE ${personWhere} AND m.active = 1`,
      )
      .bind(value)
      .all<RawMedication & { personName: string }>(),
    db
      .prepare(
        `SELECT st.medication_id AS medicationId, st.local_time AS localTime
         FROM medication_schedule_times st JOIN medications m ON m.id = st.medication_id
         JOIN persons p ON p.id = m.person_id WHERE ${personWhere}
         ORDER BY st.medication_id, st.position, st.local_time`,
      )
      .bind(value)
      .all<RawScheduleTime>(),
    db
      .prepare(
        `SELECT i.id, i.medication_id AS medicationId, i.person_id AS personId,
           i.scheduled_for AS scheduledFor, i.reported_at AS reportedAt,
           i.status, i.notes, i.recorded_by_name AS recordedByName,
           i.created_at AS createdAt, i.voided_at AS voidedAt
         FROM medication_intakes i JOIN persons p ON p.id = i.person_id
         WHERE ${personWhere} AND i.voided_at IS NULL
           AND i.scheduled_for >= ? AND i.scheduled_for < ?`,
      )
      .bind(value, intakeStart.toISOString(), intakeEnd.toISOString())
      .all<MedicationIntake>(),
  ]);
  const names = new Map(
    rawMedications.results.map((item) => [item.id, item.personName]),
  );
  const medications = hydrateMedications(rawMedications.results, times.results);
  const [year, month, day] = today.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
  const doseSources = [today, tomorrow].flatMap((date) =>
    deriveMedicationOccurrences({
      medications,
      intakes: intakes.results,
      date,
    })
      .filter(
        (occurrence) =>
          occurrence.scheduledFor &&
          (occurrence.status === 'upcoming' ||
            occurrence.status === 'unrecorded'),
      )
      .map(
        (occurrence): Extract<AlertSource, { kind: 'medication-dose' }> => ({
          kind: 'medication-dose',
          id: occurrence.medicationId,
          personId:
            medications.find((item) => item.id === occurrence.medicationId)
              ?.personId || '',
          personName: names.get(occurrence.medicationId) || '',
          medicationName: occurrence.medicationName,
          dose: occurrence.dose,
          scheduledFor: occurrence.scheduledFor!,
        }),
      ),
  );
  const stockSources = medications.filter(isLowStock).map(
    (medication): Extract<AlertSource, { kind: 'medication-stock' }> => ({
      kind: 'medication-stock',
      id: medication.id,
      personId: medication.personId,
      personName: names.get(medication.id) || '',
      medicationName: medication.name,
      stockQuantity: medication.stockQuantity!,
      stockUnit: medication.stockUnit,
      stockCycle: medication.stockCycle || 1,
    }),
  );
  return [...doseSources, ...stockSources];
}

export async function loadAlertContext(
  request: Request,
  requestedGroupId?: string,
): Promise<AlertContext> {
  const scope = await resolveScope(request, requestedGroupId);
  const db = getD1();
  const [sources, preferences, states] = await Promise.all([
    loadSources(scope.user, scope.careGroupId, scope.personId),
    db
      .prepare(
        `SELECT appointment_lead_minutes AS appointmentLeadMinutes,
           task_lead_days AS taskLeadDays,
           document_lead_days AS documentLeadDays,
           medication_lead_minutes AS medicationLeadMinutes,
           medication_stock_enabled AS medicationStockEnabled
         FROM alert_preferences WHERE user_id = ?`,
      )
      .bind(scope.user.id)
      .first<
        Omit<AlertPreferences, 'medicationStockEnabled'> & {
          medicationStockEnabled: number;
        }
      >(),
    db
      .prepare(
        `SELECT alert_key AS alertKey, read_at AS readAt,
           snoozed_until AS snoozedUntil
         FROM alert_states WHERE user_id = ?`,
      )
      .bind(scope.user.id)
      .all<StoredAlertState>(),
  ]);
  return {
    ...scope,
    preferences: preferences
      ? {
          ...preferences,
          medicationStockEnabled: Boolean(preferences.medicationStockEnabled),
        }
      : DEFAULT_ALERT_PREFERENCES,
    sources,
    states: states.results,
  };
}

export async function alertsForRequest(
  request: Request,
  requestedGroupId?: string,
  now = new Date(),
) {
  const context = await loadAlertContext(request, requestedGroupId);
  return {
    context,
    alerts: deriveAlerts({
      sources: context.sources,
      preferences: context.preferences,
      states: context.states,
      now,
    }),
  };
}
