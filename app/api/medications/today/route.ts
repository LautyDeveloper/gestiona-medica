import { z } from 'zod';
import { getD1 } from '@/db';
import type { MedicationIntake, MedicationTodayData } from '@/lib/models';
import {
  argentinaDate,
  argentinaLocalInstant,
  deriveMedicationOccurrences,
} from '@/lib/medications';
import { handleApiError, jsonError } from '@/lib/api-response';
import { resolveMedicationPerson } from '@/lib/server-medication-access';
import {
  hydrateMedications,
  MEDICATION_SELECT,
  type RawMedication,
  type RawScheduleTime,
} from '@/lib/server-medications';

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const dateResult = dateSchema.safeParse(
      url.searchParams.get('date') || undefined,
    );
    if (!dateResult.success) return jsonError('Fecha inválida', 400);
    const scope = await resolveMedicationPerson(
      request,
      url.searchParams.get('personId') || undefined,
      url.searchParams.get('careGroupId') || undefined,
    );
    const date = dateResult.data || argentinaDate();
    const start = argentinaLocalInstant(date, '00:00');
    const end = new Date(start.getTime() + 86_400_000);
    const recentStart = new Date(start.getTime() - 7 * 86_400_000);
    const db = getD1();
    const [medications, times, intakes] = await Promise.all([
      db
        .prepare(
          `SELECT ${MEDICATION_SELECT} FROM medications
           WHERE person_id = ? AND active = 1 ORDER BY name COLLATE NOCASE`,
        )
        .bind(scope.personId)
        .all<RawMedication>(),
      db
        .prepare(
          `SELECT medication_id AS medicationId, local_time AS localTime
           FROM medication_schedule_times
           WHERE medication_id IN (SELECT id FROM medications WHERE person_id = ?)
           ORDER BY medication_id, position, local_time`,
        )
        .bind(scope.personId)
        .all<RawScheduleTime>(),
      db
        .prepare(
          `SELECT id, medication_id AS medicationId, person_id AS personId,
             scheduled_for AS scheduledFor, reported_at AS reportedAt,
             status, notes, recorded_by_name AS recordedByName,
             created_at AS createdAt, voided_at AS voidedAt
           FROM medication_intakes
           WHERE person_id = ? AND reported_at >= ? AND reported_at < ?
           ORDER BY reported_at DESC`,
        )
        .bind(scope.personId, recentStart.toISOString(), end.toISOString())
        .all<MedicationIntake>(),
    ]);
    const hydrated = hydrateMedications(medications.results, times.results);
    const occurrences = deriveMedicationOccurrences({
      medications: hydrated,
      intakes: intakes.results,
      date,
    });
    return Response.json({
      personId: scope.personId,
      date,
      occurrences,
      recentIntakes: intakes.results,
    } satisfies MedicationTodayData);
  } catch (caught) {
    return handleApiError(caught, 'No se pudieron cargar las tomas');
  }
}
