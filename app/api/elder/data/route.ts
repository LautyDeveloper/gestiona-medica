import { getD1 } from '@/db';
import type { Appointment, ElderData, MedicalTask, Person } from '@/lib/models';
import { authError, AuthError, requireElder } from '@/lib/server-auth';
import {
  hydrateMedications,
  MEDICATION_SELECT,
  type RawMedication,
  type RawScheduleTime,
} from '@/lib/server-medications';

export async function GET(request: Request) {
  try {
    const user = await requireElder(request);
    const db = getD1();
    const person = await db
      .prepare(
        `SELECT p.id, p.name
         FROM person_access pa JOIN persons p ON p.id = pa.person_id
         WHERE pa.user_id = ? AND p.archived = 0`,
      )
      .bind(user.id)
      .first<Pick<Person, 'id' | 'name'>>();
    if (!person)
      throw new AuthError(
        'Esta cuenta no tiene un perfil activo asociado',
        403,
      );

    const [appointments, medications, tasks, medicationTimes] =
      await Promise.all([
        db
          .prepare(
            `SELECT id, person_id AS personId, specialty, doctor, date, time,
             place, bring, notes, status, version
           FROM appointments WHERE person_id = ? ORDER BY date, time`,
          )
          .bind(person.id)
          .all<Appointment>(),
        db
          .prepare(
            `SELECT ${MEDICATION_SELECT}
           FROM medications WHERE person_id = ? ORDER BY active DESC, name COLLATE NOCASE`,
          )
          .bind(person.id)
          .all<RawMedication>(),
        db
          .prepare(
            `SELECT id, person_id AS personId, title, due_date AS dueDate,
             priority, status, notes, visible_to_elder AS visibleToElder, version
           FROM tasks
           WHERE person_id = ? AND visible_to_elder = 1
           ORDER BY CASE status WHEN 'Pendiente' THEN 0 ELSE 1 END,
             CASE WHEN due_date = '' THEN 1 ELSE 0 END, due_date`,
          )
          .bind(person.id)
          .all<
            Omit<MedicalTask, 'visibleToElder'> & { visibleToElder: number }
          >(),
        db
          .prepare(
            `SELECT medication_id AS medicationId, local_time AS localTime
           FROM medication_schedule_times
           WHERE medication_id IN (SELECT id FROM medications WHERE person_id = ?)
           ORDER BY medication_id, position, local_time`,
          )
          .bind(person.id)
          .all<RawScheduleTime>(),
      ]);

    return Response.json({
      person,
      appointments: appointments.results,
      medications: hydrateMedications(
        medications.results,
        medicationTimes.results,
      ),
      tasks: tasks.results.map((item) => ({
        ...item,
        visibleToElder: Boolean(item.visibleToElder),
      })),
    } satisfies ElderData);
  } catch (error) {
    return authError(error);
  }
}
