// @vitest-environment node

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL('../drizzle/0005_remove_elder_access.sql', import.meta.url),
  ),
  'utf8',
)
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim())
  .filter(Boolean);

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE care_groups (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE users (id TEXT PRIMARY KEY, user_type TEXT NOT NULL);
    CREATE TABLE memberships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      care_group_id TEXT NOT NULL REFERENCES care_groups(id)
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id)
    );
    CREATE TABLE persons (
      id TEXT PRIMARY KEY,
      care_group_id TEXT NOT NULL REFERENCES care_groups(id),
      name TEXT NOT NULL
    );
    CREATE TABLE appointments (
      id TEXT PRIMARY KEY,
      person_id TEXT NOT NULL REFERENCES persons(id)
    );
    INSERT INTO care_groups VALUES ('g1', 'Familia');
    INSERT INTO users VALUES ('caregiver', 'caregiver'), ('yael', 'elder'), ('lucrecia', 'elder');
    INSERT INTO memberships VALUES ('m1', 'caregiver', 'g1'), ('m2', 'yael', 'g1'), ('m3', 'lucrecia', 'g1');
    INSERT INTO sessions VALUES ('s1', 'caregiver'), ('s2', 'yael'), ('s3', 'lucrecia');
    INSERT INTO persons VALUES ('p1', 'g1', 'Abuela de prueba');
    INSERT INTO appointments VALUES ('a1', 'p1');
  `);
  return db;
}

function apply(db: DatabaseSync) {
  for (const statement of migration) db.exec(statement);
}

function count(db: DatabaseSync, table: string) {
  return Number(
    (
      db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
        count: number;
      }
    ).count,
  );
}

describe('migración de accesos elder', () => {
  it('elimina cuentas elder y sus dependencias sin tocar datos médicos', () => {
    const db = fixture();

    apply(db);
    apply(db);

    expect(db.prepare('SELECT id FROM users ORDER BY id').all()).toEqual([
      { id: 'caregiver' },
    ]);
    expect(count(db, 'memberships')).toBe(1);
    expect(count(db, 'sessions')).toBe(1);
    expect(count(db, 'care_groups')).toBe(1);
    expect(count(db, 'persons')).toBe(1);
    expect(count(db, 'appointments')).toBe(1);
    db.close();
  });

  it('puede dejar el sistema sin usuarios conservando el grupo y las personas', () => {
    const db = fixture();
    db.exec(
      "DELETE FROM sessions WHERE user_id = 'caregiver'; DELETE FROM memberships WHERE user_id = 'caregiver'; DELETE FROM users WHERE id = 'caregiver';",
    );

    apply(db);

    expect(count(db, 'users')).toBe(0);
    expect(count(db, 'care_groups')).toBe(1);
    expect(count(db, 'persons')).toBe(1);
    db.close();
  });
});
