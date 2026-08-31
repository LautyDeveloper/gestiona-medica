// @vitest-environment node

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL(
      '../drizzle/0006_medical_orders_prescriptions.sql',
      import.meta.url,
    ),
  ),
  'utf8',
)
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim())
  .filter(Boolean);

describe('migración de órdenes y recetas', () => {
  it('crea las tablas, conserva datos y desvincula destinos eliminados', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (username TEXT NOT NULL);
      CREATE UNIQUE INDEX idx_users_username_nocase ON users (username COLLATE NOCASE);
      CREATE TABLE persons (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE appointments (id TEXT PRIMARY KEY, person_id TEXT NOT NULL);
      CREATE TABLE medications (id TEXT PRIMARY KEY, person_id TEXT NOT NULL);
      INSERT INTO persons VALUES ('p1', 'Abuela');
      INSERT INTO appointments VALUES ('a1', 'p1');
      INSERT INTO medications VALUES ('m1', 'p1');
    `);
    for (const statement of migration) db.exec(statement);
    db.exec(`
      INSERT INTO medical_orders (id, person_id, specialty, reason, requested_by, issue_date, expiration_date, status, appointment_id)
      VALUES ('o1', 'p1', 'Cardiología', 'Control', 'Dra. A', '2026-08-01', '2026-09-01', 'used', 'a1');
      INSERT INTO prescriptions (id, person_id, medication_name, presentation, dose, frequency, duration, prescribed_by, issue_date, expiration_date, status, medication_id)
      VALUES ('r1', 'p1', 'Losartán', 'Comprimidos', '50 mg', 'Diario', '30 días', 'Dra. A', '2026-08-01', '2026-09-01', 'used', 'm1');
      DELETE FROM appointments WHERE id = 'a1';
      DELETE FROM medications WHERE id = 'm1';
    `);

    expect(db.prepare('SELECT COUNT(*) AS count FROM persons').get()).toEqual({
      count: 1,
    });
    expect(
      db.prepare('SELECT status, appointment_id FROM medical_orders').get(),
    ).toEqual({ status: 'used', appointment_id: null });
    expect(
      db.prepare('SELECT status, medication_id FROM prescriptions').get(),
    ).toEqual({ status: 'used', medication_id: null });
    db.close();
  });
});
