import {
  integer,
  sqliteTable,
  text,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  authSubject: text('auth_subject').notNull().unique(),
  username: text('username').notNull(),
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  createdAt: text('created_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
});

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

export const careGroupInvitations = sqliteTable(
  'care_group_invitations',
  {
    id: text('id').primaryKey(),
    careGroupId: text('care_group_id')
      .notNull()
      .references(() => careGroups.id),
    tokenHash: text('token_hash').notNull().unique(),
    createdByUserId: text('created_by_user_id')
      .notNull()
      .references(() => users.id),
    status: text('status').notNull().default('pending'),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
    respondedByUserId: text('responded_by_user_id').references(() => users.id),
    respondedAt: text('responded_at'),
  },
  (table) => [
    index('idx_invitations_group_status').on(table.careGroupId, table.status),
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
