import { getD1 } from '@/db';
import {
  DEFAULT_ALERT_PREFERENCES,
  deriveAlerts,
  type AlertSource,
  type StoredAlertState,
} from '@/lib/alerts';
import type { AlertPreferences, AppUser } from '@/lib/models';
import { AuthError, requireUser } from '@/lib/server-auth';

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
  const [appointments, tasks, orders, prescriptions] = await Promise.all([
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
  ]);
  return [
    ...appointments.results,
    ...tasks.results,
    ...orders.results,
    ...prescriptions.results,
  ] as AlertSource[];
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
           document_lead_days AS documentLeadDays
         FROM alert_preferences WHERE user_id = ?`,
      )
      .bind(scope.user.id)
      .first<AlertPreferences>(),
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
    preferences: preferences || DEFAULT_ALERT_PREFERENCES,
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
