import { getD1 } from '@/db';
import { handleApiError, jsonError, readJson } from '@/lib/api-response';
import { toStockMilli } from '@/lib/medications';
import { requireSameOrigin } from '@/lib/server-auth';
import {
  requireOwnedMedication,
  resolveMedicationPerson,
} from '@/lib/server-medication-access';
import { medicationStockAdjustmentSchema } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const body = (await readJson(request)) as {
      careGroupId?: string;
      data?: unknown;
    };
    const parsed = medicationStockAdjustmentSchema.safeParse(body.data);
    if (!parsed.success) return jsonError('Revisá la cantidad', 400);
    const scope = await resolveMedicationPerson(
      request,
      parsed.data.personId,
      body.careGroupId,
    );
    if (scope.user.userType !== 'caregiver')
      return jsonError('Sólo un cuidador puede modificar el stock', 403);
    const medication = await requireOwnedMedication(
      parsed.data.medicationId,
      scope.personId,
    );
    const quantity = toStockMilli(parsed.data.quantity)!;
    const previous = medication.stockQuantityMilli || 0;
    const next = parsed.data.mode === 'set' ? quantity : previous + quantity;
    const delta = next - previous;
    if (!delta) return Response.json({ ok: true });
    const threshold = medication.reorderThresholdMilli;
    const newCycle =
      threshold !== null && previous <= threshold && next > threshold
        ? medication.stockCycle + 1
        : medication.stockCycle;
    const now = new Date().toISOString();
    const db = getD1();
    await db.batch([
      db
        .prepare(
          `UPDATE medications SET stock_quantity_milli = ?, stock_cycle = ?,
             version = version + 1 WHERE id = ? AND person_id = ?`,
        )
        .bind(next, newCycle, medication.id, scope.personId),
      db
        .prepare(
          `INSERT INTO medication_stock_movements
             (id, medication_id, intake_id, delta_milli, reason,
              recorded_by_user_id, recorded_at)
           VALUES (?, ?, NULL, ?, 'restock', ?, ?)`,
        )
        .bind(crypto.randomUUID(), medication.id, delta, scope.user.id, now),
    ]);
    return Response.json({ ok: true, stockQuantity: next / 1000 });
  } catch (caught) {
    return handleApiError(caught, 'No se pudo actualizar el stock');
  }
}
