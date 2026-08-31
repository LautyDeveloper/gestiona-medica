// @vitest-environment node

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(
    new URL('../drizzle/0007_nappy_gertrude_yorkes.sql', import.meta.url),
  ),
  'utf8',
)
  .split('--> statement-breakpoint')
  .map((statement) => statement.trim())
  .filter(Boolean);

describe('migración de acceso por persona', () => {
  it('conserva los datos existentes y exige relaciones uno a uno', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL);
      CREATE TABLE persons (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      INSERT INTO users VALUES ('u1', 'maria'), ('u2', 'elena');
      INSERT INTO persons VALUES ('p1', 'María'), ('p2', 'Elena');
    `);
    for (const statement of migration) db.exec(statement);

    expect(db.prepare('SELECT COUNT(*) AS count FROM persons').get()).toEqual({
      count: 2,
    });
    expect(db.prepare('SELECT COUNT(*) AS count FROM users').get()).toEqual({
      count: 2,
    });
    db.exec("INSERT INTO person_access VALUES ('p1', 'u1', '2026-08-31')");
    expect(() =>
      db.exec("INSERT INTO person_access VALUES ('p1', 'u2', '2026-08-31')"),
    ).toThrow();
    expect(() =>
      db.exec("INSERT INTO person_access VALUES ('p2', 'u1', '2026-08-31')"),
    ).toThrow();
    db.close();
  });
});
