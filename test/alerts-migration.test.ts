// @vitest-environment node

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function statements(sql: string) {
  return sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

describe('migración de alertas', () => {
  it('conserva tareas y crea preferencias y estados con restricciones', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL);
      CREATE TABLE persons (id TEXT PRIMARY KEY NOT NULL);
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY NOT NULL,
        person_id TEXT NOT NULL,
        title TEXT NOT NULL,
        due_date TEXT DEFAULT '' NOT NULL,
        priority TEXT DEFAULT 'Normal' NOT NULL,
        status TEXT DEFAULT 'Pendiente' NOT NULL,
        notes TEXT DEFAULT '' NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL
      );
      CREATE INDEX idx_tasks_person_status_date
        ON tasks (person_id, status, due_date);
      INSERT INTO persons VALUES ('p1');
      INSERT INTO users VALUES ('u1');
      INSERT INTO tasks VALUES
        ('t1', 'p1', 'Pedir receta', '2026-09-01', 'Normal', 'Pendiente', '', 2);
    `);
    const sql = readFileSync(
      fileURLToPath(
        new URL('../drizzle/0010_sloppy_peter_parker.sql', import.meta.url),
      ),
      'utf8',
    );
    for (const statement of statements(sql)) db.exec(statement);
    expect(
      db
        .prepare(
          'SELECT title, visible_to_elder AS visibleToElder, version FROM tasks',
        )
        .get(),
    ).toEqual({ title: 'Pedir receta', visibleToElder: 0, version: 2 });
    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'alert_preferences'",
        )
        .get(),
    ).toEqual({ name: 'alert_preferences' });
    expect(() =>
      db
        .prepare(
          `INSERT INTO alert_preferences
           (user_id, appointment_lead_minutes, task_lead_days, document_lead_days, updated_at)
           VALUES ('u1', 5, 0, 7, '2026-09-01')`,
        )
        .run(),
    ).toThrow();
  });
});
