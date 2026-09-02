import {
  integer,
  sqliteTable,
  text,
  index,
  uniqueIndex,
  check,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    passwordHash: text('password_hash').notNull(),
    userType: text('user_type').notNull(),
    failedLoginCount: integer('failed_login_count').notNull().default(0),
    lockedUntil: text('locked_until'),
    createdAt: text('created_at').notNull(),
    lastSeenAt: text('last_seen_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_users_username_nocase').on(
      sql`${table.username} COLLATE NOCASE`,
    ),
    check('users_type_check', sql`${table.userType} IN ('caregiver', 'elder')`),
    check(
      'users_failed_login_count_check',
      sql`${table.failedLoginCount} >= 0`,
    ),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull().unique(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
  },
  (table) => [
    index('idx_sessions_user').on(table.userId),
    index('idx_sessions_expiration').on(table.expiresAt),
  ],
);

export const alertPreferences = sqliteTable(
  'alert_preferences',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    appointmentLeadMinutes: integer('appointment_lead_minutes')
      .notNull()
      .default(1440),
    taskLeadDays: integer('task_lead_days').notNull().default(0),
    documentLeadDays: integer('document_lead_days').notNull().default(7),
    medicationLeadMinutes: integer('medication_lead_minutes')
      .notNull()
      .default(0),
    medicationStockEnabled: integer('medication_stock_enabled', {
      mode: 'boolean',
    })
      .notNull()
      .default(true),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    check(
      'alert_preferences_appointment_lead_check',
      sql`${table.appointmentLeadMinutes} IN (-1, 1440, 2880, 10080)`,
    ),
    check(
      'alert_preferences_task_lead_check',
      sql`${table.taskLeadDays} IN (-1, 0, 1, 3)`,
    ),
    check(
      'alert_preferences_document_lead_check',
      sql`${table.documentLeadDays} IN (-1, 3, 7, 14)`,
    ),
    check(
      'alert_preferences_medication_lead_check',
      sql`${table.medicationLeadMinutes} IN (-1, 0, 15, 30, 60)`,
    ),
    check(
      'alert_preferences_medication_stock_check',
      sql`${table.medicationStockEnabled} IN (0, 1)`,
    ),
  ],
);

export const alertStates = sqliteTable(
  'alert_states',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    alertKey: text('alert_key').notNull(),
    readAt: text('read_at'),
    snoozedUntil: text('snoozed_until'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.alertKey] }),
    index('idx_alert_states_user_updated').on(table.userId, table.updatedAt),
  ],
);

export const loginRateLimits = sqliteTable(
  'login_rate_limits',
  {
    keyHash: text('key_hash').primaryKey(),
    attemptCount: integer('attempt_count').notNull().default(0),
    windowStartedAt: text('window_started_at').notNull(),
    blockedUntil: text('blocked_until'),
  },
  (table) => [
    check(
      'login_rate_limits_attempt_count_check',
      sql`${table.attemptCount} >= 0`,
    ),
  ],
);

export const careGroups = sqliteTable('care_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
});

export const memberships = sqliteTable(
  'memberships',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    careGroupId: text('care_group_id')
      .notNull()
      .references(() => careGroups.id),
    role: text('role').notNull().default('member'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_memberships_group_user').on(
      table.careGroupId,
      table.userId,
    ),
    index('idx_memberships_user').on(table.userId),
    check('memberships_role_check', sql`${table.role} IN ('admin', 'member')`),
  ],
);

export const persons = sqliteTable(
  'persons',
  {
    id: text('id').primaryKey(),
    careGroupId: text('care_group_id')
      .notNull()
      .references(() => careGroups.id),
    name: text('name').notNull(),
    birthDate: text('birth_date').notNull().default(''),
    relationship: text('relationship').notNull().default(''),
    notes: text('notes').notNull().default(''),
    archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('idx_persons_group_archived_name').on(
      table.careGroupId,
      table.archived,
      table.name,
    ),
    check('persons_archived_check', sql`${table.archived} IN (0, 1)`),
    check('persons_version_check', sql`${table.version} > 0`),
  ],
);

export const personAccess = sqliteTable('person_access', {
  personId: text('person_id')
    .primaryKey()
    .references(() => persons.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').notNull(),
});

export const appointments = sqliteTable(
  'appointments',
  {
    id: text('id').primaryKey(),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id),
    specialty: text('specialty').notNull(),
    doctor: text('doctor').notNull(),
    date: text('date').notNull(),
    time: text('time').notNull(),
    place: text('place').notNull(),
    bring: text('bring').notNull(),
    notes: text('notes').notNull().default(''),
    status: text('status').notNull().default('Próximo'),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('idx_appointments_person_date').on(table.personId, table.date),
    check(
      'appointments_status_check',
      sql`${table.status} IN ('Próximo', 'Realizado', 'Cancelado')`,
    ),
    check('appointments_version_check', sql`${table.version} > 0`),
  ],
);
export const medications = sqliteTable(
  'medications',
  {
    id: text('id').primaryKey(),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id),
    name: text('name').notNull(),
    dose: text('dose').notNull(),
    frequency: text('frequency').notNull(),
    doctor: text('doctor').notNull(),
    notes: text('notes').notNull().default(''),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    scheduleType: text('schedule_type').notNull().default('unstructured'),
    startDate: text('start_date').notNull().default(''),
    endDate: text('end_date').notNull().default(''),
    intervalMinutes: integer('interval_minutes'),
    intervalAnchorAt: text('interval_anchor_at').notNull().default(''),
    presentation: text('presentation').notNull().default(''),
    stockUnit: text('stock_unit').notNull().default(''),
    unitsPerIntakeMilli: integer('units_per_intake_milli'),
    stockQuantityMilli: integer('stock_quantity_milli'),
    reorderThresholdMilli: integer('reorder_threshold_milli'),
    stockCycle: integer('stock_cycle').notNull().default(1),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('idx_medications_person_active').on(table.personId, table.active),
    check('medications_active_check', sql`${table.active} IN (0, 1)`),
    check(
      'medications_schedule_type_check',
      sql`${table.scheduleType} IN ('unstructured', 'fixed_times', 'interval', 'as_needed')`,
    ),
    check(
      'medications_dates_check',
      sql`${table.endDate} = '' OR ${table.startDate} = '' OR ${table.endDate} >= ${table.startDate}`,
    ),
    check(
      'medications_interval_check',
      sql`${table.intervalMinutes} IS NULL OR ${table.intervalMinutes} > 0`,
    ),
    check(
      'medications_units_per_intake_check',
      sql`${table.unitsPerIntakeMilli} IS NULL OR ${table.unitsPerIntakeMilli} > 0`,
    ),
    check(
      'medications_reorder_threshold_check',
      sql`${table.reorderThresholdMilli} IS NULL OR ${table.reorderThresholdMilli} >= 0`,
    ),
    check('medications_stock_cycle_check', sql`${table.stockCycle} > 0`),
    check('medications_version_check', sql`${table.version} > 0`),
  ],
);

export const medicationScheduleTimes = sqliteTable(
  'medication_schedule_times',
  {
    id: text('id').primaryKey(),
    medicationId: text('medication_id')
      .notNull()
      .references(() => medications.id, { onDelete: 'cascade' }),
    localTime: text('local_time').notNull(),
    position: integer('position').notNull().default(0),
  },
  (table) => [
    uniqueIndex('idx_medication_schedule_times_unique').on(
      table.medicationId,
      table.localTime,
    ),
    index('idx_medication_schedule_times_medication').on(table.medicationId),
    check(
      'medication_schedule_times_time_check',
      sql`length(${table.localTime}) = 5 AND substr(${table.localTime}, 1, 2) BETWEEN '00' AND '23' AND substr(${table.localTime}, 3, 1) = ':' AND substr(${table.localTime}, 4, 2) BETWEEN '00' AND '59'`,
    ),
    check(
      'medication_schedule_times_position_check',
      sql`${table.position} >= 0`,
    ),
  ],
);

export const medicationIntakes = sqliteTable(
  'medication_intakes',
  {
    id: text('id').primaryKey(),
    medicationId: text('medication_id')
      .notNull()
      .references(() => medications.id, { onDelete: 'cascade' }),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    scheduledFor: text('scheduled_for'),
    reportedAt: text('reported_at').notNull(),
    status: text('status').notNull(),
    notes: text('notes').notNull().default(''),
    recordedByUserId: text('recorded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    recordedByName: text('recorded_by_name').notNull(),
    createdAt: text('created_at').notNull(),
    voidedAt: text('voided_at'),
    voidedByUserId: text('voided_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
  },
  (table) => [
    index('idx_medication_intakes_person_reported').on(
      table.personId,
      table.reportedAt,
    ),
    index('idx_medication_intakes_medication_reported').on(
      table.medicationId,
      table.reportedAt,
    ),
    uniqueIndex('idx_medication_intakes_scheduled_active')
      .on(table.medicationId, table.scheduledFor)
      .where(
        sql`${table.scheduledFor} IS NOT NULL AND ${table.voidedAt} IS NULL`,
      ),
    check(
      'medication_intakes_status_check',
      sql`${table.status} IN ('taken', 'not_taken')`,
    ),
  ],
);

export const medicationStockMovements = sqliteTable(
  'medication_stock_movements',
  {
    id: text('id').primaryKey(),
    medicationId: text('medication_id')
      .notNull()
      .references(() => medications.id, { onDelete: 'cascade' }),
    intakeId: text('intake_id').references(() => medicationIntakes.id, {
      onDelete: 'set null',
    }),
    deltaMilli: integer('delta_milli').notNull(),
    reason: text('reason').notNull(),
    recordedByUserId: text('recorded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    recordedAt: text('recorded_at').notNull(),
  },
  (table) => [
    index('idx_medication_stock_movements_medication').on(
      table.medicationId,
      table.recordedAt,
    ),
    uniqueIndex('idx_medication_stock_movements_intake').on(table.intakeId),
    check(
      'medication_stock_movements_reason_check',
      sql`${table.reason} IN ('initial', 'restock', 'intake', 'correction')`,
    ),
    check(
      'medication_stock_movements_delta_check',
      sql`${table.deltaMilli} != 0`,
    ),
  ],
);
export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id),
    title: text('title').notNull(),
    dueDate: text('due_date').notNull().default(''),
    priority: text('priority').notNull().default('Normal'),
    status: text('status').notNull().default('Pendiente'),
    notes: text('notes').notNull().default(''),
    visibleToElder: integer('visible_to_elder', { mode: 'boolean' })
      .notNull()
      .default(false),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('idx_tasks_person_status_date').on(
      table.personId,
      table.status,
      table.dueDate,
    ),
    check(
      'tasks_priority_check',
      sql`${table.priority} IN ('Normal', 'Importante', 'Urgente')`,
    ),
    check(
      'tasks_status_check',
      sql`${table.status} IN ('Pendiente', 'Completado')`,
    ),
    check(
      'tasks_visible_to_elder_check',
      sql`${table.visibleToElder} IN (0, 1)`,
    ),
    check('tasks_version_check', sql`${table.version} > 0`),
  ],
);

export const medicalOrders = sqliteTable(
  'medical_orders',
  {
    id: text('id').primaryKey(),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id),
    specialty: text('specialty').notNull(),
    reason: text('reason').notNull(),
    requestedBy: text('requested_by').notNull(),
    issueDate: text('issue_date').notNull(),
    expirationDate: text('expiration_date').notNull(),
    notes: text('notes').notNull().default(''),
    status: text('status').notNull().default('pending'),
    appointmentId: text('appointment_id').references(() => appointments.id, {
      onDelete: 'set null',
    }),
    usedAt: text('used_at'),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('idx_medical_orders_person_status_expiration').on(
      table.personId,
      table.status,
      table.expirationDate,
    ),
    check(
      'medical_orders_status_check',
      sql`${table.status} IN ('pending', 'used')`,
    ),
    check('medical_orders_version_check', sql`${table.version} > 0`),
  ],
);

export const prescriptions = sqliteTable(
  'prescriptions',
  {
    id: text('id').primaryKey(),
    personId: text('person_id')
      .notNull()
      .references(() => persons.id),
    medicationName: text('medication_name').notNull(),
    presentation: text('presentation').notNull(),
    dose: text('dose').notNull(),
    frequency: text('frequency').notNull(),
    duration: text('duration').notNull(),
    prescribedBy: text('prescribed_by').notNull(),
    issueDate: text('issue_date').notNull(),
    expirationDate: text('expiration_date').notNull(),
    notes: text('notes').notNull().default(''),
    status: text('status').notNull().default('pending'),
    medicationId: text('medication_id').references(() => medications.id, {
      onDelete: 'set null',
    }),
    usedAt: text('used_at'),
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('idx_prescriptions_person_status_expiration').on(
      table.personId,
      table.status,
      table.expirationDate,
    ),
    check(
      'prescriptions_status_check',
      sql`${table.status} IN ('pending', 'used')`,
    ),
    check('prescriptions_version_check', sql`${table.version} > 0`),
  ],
);
