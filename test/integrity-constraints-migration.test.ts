// @vitest-environment node

import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const drizzleDirectory = fileURLToPath(new URL('../drizzle', import.meta.url));

function statements(filename: string) {
  return readFileSync(join(drizzleDirectory, filename), 'utf8')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

function apply(db: DatabaseSync, filename: string) {
  for (const statement of statements(filename)) db.exec(statement);
}

describe('restricciones de integridad', () => {
  it('conserva datos válidos y rechaza estados fuera del dominio', () => {
    const db = new DatabaseSync(':memory:');
    const migrations = readdirSync(drizzleDirectory)
      .filter((name) => /^000[0-8]_.+\.sql$/.test(name))
      .sort();
    for (const migration of migrations) apply(db, migration);

    db.exec(`
      INSERT INTO care_groups VALUES ('g1', 'Familia', '2026-08-31');
      INSERT INTO users VALUES ('u1', 'ana', 'Ana', 'hash', 'caregiver', 0, NULL, '2026-08-31', '2026-08-31');
      INSERT INTO memberships VALUES ('m1', 'u1', 'g1', 'admin', '2026-08-31');
      INSERT INTO persons (id, care_group_id, name, birth_date, relationship, notes, archived, version)
      VALUES ('p1', 'g1', 'María', '1940-01-01', 'Abuela', '', 0, 1);
      INSERT INTO appointments VALUES ('a1', 'p1', 'Cardiología', 'Dra. A', '2026-09-01', '10:00', 'Hospital', 'DNI', '', 'Próximo', 1);
      INSERT INTO medications VALUES ('med1', 'p1', 'Losartán', '50 mg', 'Diario', 'Dra. A', '', 1, 1);
      INSERT INTO tasks VALUES ('t1', 'p1', 'Pedir receta', '', 'Urgente', 'Pendiente', '', 1);
    `);

    db.exec('BEGIN');
    apply(db, '0009_ancient_carlie_cooper.sql');
    db.exec('COMMIT');

    expect(db.prepare('SELECT COUNT(*) AS count FROM persons').get()).toEqual({
      count: 1,
    });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    expect(() =>
      db.exec("UPDATE appointments SET status = 'Desconocido' WHERE id = 'a1'"),
    ).toThrow();
    expect(() =>
      db.exec("UPDATE medications SET active = 2 WHERE id = 'med1'"),
    ).toThrow();
    expect(() =>
      db.exec("UPDATE tasks SET priority = 'Crítica' WHERE id = 't1'"),
    ).toThrow();
    expect(() =>
      db.exec("UPDATE users SET user_type = 'root' WHERE id = 'u1'"),
    ).toThrow();
    expect(() =>
      db.exec("UPDATE persons SET version = 0 WHERE id = 'p1'"),
    ).toThrow();
    db.close();
  });
});
