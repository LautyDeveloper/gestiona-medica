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

describe('migración de medicación estructurada', () => {
  it('preserva tratamientos y agrega estructura con defaults seguros', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(`
      CREATE TABLE users (id TEXT PRIMARY KEY NOT NULL);
      CREATE TABLE persons (id TEXT PRIMARY KEY NOT NULL);
      CREATE TABLE alert_preferences (
        user_id TEXT PRIMARY KEY NOT NULL,
        appointment_lead_minutes INTEGER DEFAULT 1440 NOT NULL,
        task_lead_days INTEGER DEFAULT 0 NOT NULL,
        document_lead_days INTEGER DEFAULT 7 NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE medications (
        id TEXT PRIMARY KEY NOT NULL,
        person_id TEXT NOT NULL,
        name TEXT NOT NULL,
        dose TEXT NOT NULL,
        frequency TEXT NOT NULL,
        doctor TEXT NOT NULL,
        notes TEXT DEFAULT '' NOT NULL,
        active INTEGER DEFAULT 1 NOT NULL,
        version INTEGER DEFAULT 1 NOT NULL
      );
      CREATE INDEX idx_medications_person_active ON medications(person_id, active);
      INSERT INTO users VALUES ('u1');
      INSERT INTO persons VALUES ('p1');
      INSERT INTO alert_preferences VALUES ('u1', 1440, 0, 7, '2026-09-01');
      INSERT INTO medications VALUES
        ('m1', 'p1', 'Losartán', '50 mg', 'Por la noche', 'Dra. A', '', 1, 3);
    `);
    const sql = readFileSync(
      fileURLToPath(
        new URL('../drizzle/0011_keen_mac_gargan.sql', import.meta.url),
      ),
      'utf8',
    );
    for (const statement of statements(sql)) db.exec(statement);
    expect(
      db
        .prepare(
          `SELECT name, frequency, schedule_type AS scheduleType,
             start_date AS startDate, version FROM medications`,
        )
        .get(),
    ).toEqual({
      name: 'Losartán',
      frequency: 'Por la noche',
      scheduleType: 'unstructured',
      startDate: '',
      version: 3,
    });
    expect(
      db
        .prepare(
          `SELECT medication_lead_minutes AS lead,
             medication_stock_enabled AS stock FROM alert_preferences`,
        )
        .get(),
    ).toEqual({ lead: 0, stock: 1 });
    expect(() =>
      db
        .prepare(
          "UPDATE medications SET schedule_type = 'invented' WHERE id = 'm1'",
        )
        .run(),
    ).toThrow();
  });
});
