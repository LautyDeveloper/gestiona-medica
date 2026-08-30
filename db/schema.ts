import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const persons = sqliteTable('persons', { id: text('id').primaryKey(), name: text('name').notNull() });
export const appointments = sqliteTable('appointments', {
  id: text('id').primaryKey(), personId: text('person_id').notNull().references(() => persons.id), specialty: text('specialty').notNull(), doctor: text('doctor').notNull(), date: text('date').notNull(), time: text('time').notNull(), place: text('place').notNull(), bring: text('bring').notNull(), notes: text('notes').notNull().default(''), status: text('status').notNull().default('Próximo'),
}, (table) => [index('idx_appointments_person_date').on(table.personId, table.date)]);
export const medications = sqliteTable('medications', {
  id: text('id').primaryKey(), personId: text('person_id').notNull().references(() => persons.id), name: text('name').notNull(), dose: text('dose').notNull(), frequency: text('frequency').notNull(), doctor: text('doctor').notNull(), notes: text('notes').notNull().default(''), active: integer('active', { mode: 'boolean' }).notNull().default(true),
}, (table) => [index('idx_medications_person_active').on(table.personId, table.active)]);
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(), personId: text('person_id').notNull().references(() => persons.id), title: text('title').notNull(), dueDate: text('due_date').notNull().default(''), priority: text('priority').notNull().default('Normal'), status: text('status').notNull().default('Pendiente'), notes: text('notes').notNull().default(''),
}, (table) => [index('idx_tasks_person_status_date').on(table.personId, table.status, table.dueDate)]);
