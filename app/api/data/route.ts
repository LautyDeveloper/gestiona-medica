import { env } from 'cloudflare:workers';
import { NextResponse } from 'next/server';
import { demoData } from '@/lib/demo-data';
import type { Entity } from '@/lib/models';

const tables: Record<Entity, string> = { appointment: 'appointments', medication: 'medications', task: 'tasks' };

async function ensureDatabase() {
  const db = env.DB;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS persons (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS appointments (id TEXT PRIMARY KEY NOT NULL, person_id TEXT NOT NULL REFERENCES persons(id), specialty TEXT NOT NULL, doctor TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, place TEXT NOT NULL, bring TEXT NOT NULL, notes TEXT NOT NULL DEFAULT \'\', status TEXT NOT NULL DEFAULT \'Próximo\')'),
    db.prepare('CREATE TABLE IF NOT EXISTS medications (id TEXT PRIMARY KEY NOT NULL, person_id TEXT NOT NULL REFERENCES persons(id), name TEXT NOT NULL, dose TEXT NOT NULL, frequency TEXT NOT NULL, doctor TEXT NOT NULL, notes TEXT NOT NULL DEFAULT \'\', active INTEGER NOT NULL DEFAULT 1)'),
    db.prepare('CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY NOT NULL, person_id TEXT NOT NULL REFERENCES persons(id), title TEXT NOT NULL, due_date TEXT NOT NULL DEFAULT \'\', priority TEXT NOT NULL DEFAULT \'Normal\', status TEXT NOT NULL DEFAULT \'Pendiente\', notes TEXT NOT NULL DEFAULT \'\')'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_appointments_person_date ON appointments(person_id, date)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_medications_person_active ON medications(person_id, active)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_person_status_date ON tasks(person_id, status, due_date)'),
  ]);
  const count = await db.prepare('SELECT COUNT(*) AS count FROM persons').first<{ count: number }>();
  if (!count?.count) {
    await db.batch([
      db.prepare('INSERT INTO persons (id, name) VALUES (?, ?)').bind(demoData.person.id, demoData.person.name),
      ...demoData.appointments.map((i) => db.prepare('INSERT INTO appointments (id, person_id, specialty, doctor, date, time, place, bring, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(i.id, i.personId, i.specialty, i.doctor, i.date, i.time, i.place, i.bring, i.notes, i.status)),
      ...demoData.medications.map((i) => db.prepare('INSERT INTO medications (id, person_id, name, dose, frequency, doctor, notes, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(i.id, i.personId, i.name, i.dose, i.frequency, i.doctor, i.notes, i.active ? 1 : 0)),
      ...demoData.tasks.map((i) => db.prepare('INSERT INTO tasks (id, person_id, title, due_date, priority, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(i.id, i.personId, i.title, i.dueDate, i.priority, i.status, i.notes)),
    ]);
    await db.prepare('PRAGMA optimize').run();
  }
}

export async function GET() {
  await ensureDatabase();
  const db = env.DB;
  const [person, appointments, medications, tasks] = await Promise.all([
    db.prepare('SELECT id, name FROM persons LIMIT 1').first(),
    db.prepare('SELECT id, person_id AS personId, specialty, doctor, date, time, place, bring, notes, status FROM appointments ORDER BY date, time').all(),
    db.prepare('SELECT id, person_id AS personId, name, dose, frequency, doctor, notes, active FROM medications ORDER BY active DESC, name').all(),
    db.prepare("SELECT id, person_id AS personId, title, due_date AS dueDate, priority, status, notes FROM tasks ORDER BY CASE status WHEN 'Pendiente' THEN 0 ELSE 1 END, CASE WHEN due_date = '' THEN 1 ELSE 0 END, due_date").all(),
  ]);
  return NextResponse.json({ person, appointments: appointments.results, medications: medications.results.map((i) => ({ ...i, active: Boolean(i.active) })), tasks: tasks.results });
}

export async function POST(request: Request) {
  await ensureDatabase();
  const { entity, data } = (await request.json()) as { entity: Entity; data: Record<string, unknown> };
  const id = crypto.randomUUID();
  const personId = typeof data.personId === 'string' ? data.personId : demoData.person.id;
  if (entity === 'appointment') await env.DB.prepare('INSERT INTO appointments (id, person_id, specialty, doctor, date, time, place, bring, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, personId, data.specialty, data.doctor, data.date, data.time, data.place, data.bring, data.notes || '', data.status || 'Próximo').run();
  else if (entity === 'medication') await env.DB.prepare('INSERT INTO medications (id, person_id, name, dose, frequency, doctor, notes, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(id, personId, data.name, data.dose, data.frequency, data.doctor, data.notes || '', data.active === false ? 0 : 1).run();
  else if (entity === 'task') await env.DB.prepare('INSERT INTO tasks (id, person_id, title, due_date, priority, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, personId, data.title, data.dueDate || '', data.priority || 'Normal', data.status || 'Pendiente', data.notes || '').run();
  else return NextResponse.json({ error: 'Entidad inválida' }, { status: 400 });
  return NextResponse.json({ id });
}

export async function PATCH(request: Request) {
  await ensureDatabase();
  const { entity, id, data } = (await request.json()) as { entity: Entity; id: string; data: Record<string, unknown> };
  if (entity === 'appointment') await env.DB.prepare('UPDATE appointments SET specialty = ?, doctor = ?, date = ?, time = ?, place = ?, bring = ?, notes = ?, status = ? WHERE id = ?').bind(data.specialty, data.doctor, data.date, data.time, data.place, data.bring, data.notes || '', data.status, id).run();
  else if (entity === 'medication') await env.DB.prepare('UPDATE medications SET name = ?, dose = ?, frequency = ?, doctor = ?, notes = ?, active = ? WHERE id = ?').bind(data.name, data.dose, data.frequency, data.doctor, data.notes || '', data.active ? 1 : 0, id).run();
  else if (entity === 'task') await env.DB.prepare('UPDATE tasks SET title = ?, due_date = ?, priority = ?, status = ?, notes = ? WHERE id = ?').bind(data.title, data.dueDate || '', data.priority, data.status, data.notes || '', id).run();
  else return NextResponse.json({ error: 'Entidad inválida' }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  await ensureDatabase();
  const url = new URL(request.url);
  const entity = url.searchParams.get('entity') as Entity;
  const id = url.searchParams.get('id');
  if (!tables[entity] || !id) return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 });
  await env.DB.prepare(`DELETE FROM ${tables[entity]} WHERE id = ?`).bind(id).run();
  return NextResponse.json({ ok: true });
}
