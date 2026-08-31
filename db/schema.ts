import {
  integer,
  sqliteTable,
  text,
  index,
  uniqueIndex,
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
  (table) => [index('idx_sessions_user').on(table.userId)],
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
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('idx_medications_person_active').on(table.personId, table.active),
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
    version: integer('version').notNull().default(1),
  },
  (table) => [
    index('idx_tasks_person_status_date').on(
      table.personId,
      table.status,
      table.dueDate,
    ),
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
  ],
);
