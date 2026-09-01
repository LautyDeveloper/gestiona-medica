import { getD1 } from '@/db';
import { personArchiveSchema } from '@/lib/validation';
import { requireMembership, requireSameOrigin } from '@/lib/server-auth';
import { handleApiError, jsonError, readJson } from '@/lib/api-response';

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const body = (await readJson(request)) as {
      id?: unknown;
      archived?: unknown;
      version?: unknown;
      careGroupId?: string;
    };
    const parsed = personArchiveSchema.safeParse(body);
    if (!parsed.success) return jsonError('Solicitud inválida', 400);
    await requireMembership(request, body.careGroupId || '');
    const db = getD1();
    const access = parsed.data.archived
      ? await db
          .prepare(
            `SELECT pa.user_id AS userId FROM person_access pa
             JOIN persons p ON p.id = pa.person_id
             WHERE pa.person_id = ? AND p.care_group_id = ?`,
          )
          .bind(parsed.data.id, body.careGroupId)
          .first<{ userId: string }>()
      : null;
    if (access)
      await requireMembership(request, body.careGroupId || '', 'admin');
    const statements = [
      db
        .prepare(
          'UPDATE persons SET archived = ?, version = version + 1 WHERE id = ? AND care_group_id = ? AND version = ?',
        )
        .bind(
          parsed.data.archived ? 1 : 0,
          parsed.data.id,
          body.careGroupId,
          parsed.data.version,
        ),
    ];
    if (access)
      statements.push(
        db
          .prepare(
            'DELETE FROM sessions WHERE user_id = ? AND EXISTS (SELECT 1 FROM persons WHERE id = ? AND archived = 1)',
          )
          .bind(access.userId, parsed.data.id),
        db
          .prepare(
            'DELETE FROM memberships WHERE user_id = ? AND EXISTS (SELECT 1 FROM persons WHERE id = ? AND archived = 1)',
          )
          .bind(access.userId, parsed.data.id),
        db
          .prepare(
            'DELETE FROM person_access WHERE user_id = ? AND EXISTS (SELECT 1 FROM persons WHERE id = ? AND archived = 1)',
          )
          .bind(access.userId, parsed.data.id),
        db
          .prepare(
            "DELETE FROM users WHERE id = ? AND user_type = 'elder' AND EXISTS (SELECT 1 FROM persons WHERE id = ? AND archived = 1)",
          )
          .bind(access.userId, parsed.data.id),
      );
    const [result] = await db.batch(statements);
    if (!result.meta.changes)
      return jsonError('El perfil cambió en otro dispositivo', 409);
    return Response.json({ ok: true });
  } catch (caught) {
    return handleApiError(caught, 'No se pudo cambiar el estado del perfil');
  }
}
