import { z } from 'zod';
import { getD1 } from '@/db';
import { handleApiError, jsonError, readJson } from '@/lib/api-response';
import { requireMembership, requireSameOrigin } from '@/lib/server-auth';

const usePrescriptionSchema = z.object({
  prescriptionId: z.uuid(),
  personId: z.uuid(),
  careGroupId: z.uuid(),
  version: z.number().int().positive(),
});

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = usePrescriptionSchema.safeParse(await readJson(request));
    if (!body.success)
      return jsonError('La receta solicitada no es válida', 400);
    await requireMembership(request, body.data.careGroupId);

    const db = getD1();
    const prescription = await db
      .prepare(
        `SELECT r.status, r.expiration_date AS expirationDate,
                r.medication_id AS medicationId, r.version
         FROM prescriptions r
         JOIN persons p ON p.id = r.person_id
         WHERE r.id = ? AND r.person_id = ?
           AND p.care_group_id = ? AND p.archived = 0`,
      )
      .bind(body.data.prescriptionId, body.data.personId, body.data.careGroupId)
      .first<{
        status: 'pending' | 'used';
        expirationDate: string;
        medicationId: string | null;
        version: number;
      }>();

    if (!prescription)
      return jsonError('La receta no existe para esta persona', 404);
    if (prescription.status === 'used')
      return jsonError('Esta receta ya fue utilizada', 409);
    if (prescription.expirationDate < todayInArgentina())
      return jsonError('La receta está vencida', 409);
    if (!prescription.medicationId)
      return jsonError(
        'Asociá un medicamento antes de utilizar la receta',
        409,
      );
    if (prescription.version !== body.data.version)
      return jsonError(
        'La receta cambió en otro dispositivo. Recargá e intentá nuevamente.',
        409,
      );

    const result = await db
      .prepare(
        `UPDATE prescriptions
         SET status = 'used', used_at = ?, medication_id = ?,
             version = version + 1
         WHERE id = ? AND person_id = ? AND status = 'pending'
           AND expiration_date >= ? AND medication_id = ? AND version = ?
           AND EXISTS (
             SELECT 1 FROM medications
             WHERE id = ? AND person_id = ?
           )`,
      )
      .bind(
        new Date().toISOString(),
        prescription.medicationId,
        body.data.prescriptionId,
        body.data.personId,
        todayInArgentina(),
        prescription.medicationId,
        body.data.version,
        prescription.medicationId,
        body.data.personId,
      )
      .run();

    if (!result.meta.changes)
      return jsonError('La receta ya no está disponible para utilizar', 409);
    return Response.json({ ok: true });
  } catch (caught) {
    return handleApiError(caught, 'No se pudo utilizar la receta');
  }
}
