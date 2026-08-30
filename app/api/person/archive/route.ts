import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { personArchiveSchema } from '@/lib/validation';
import { authError, requireMembership } from '@/lib/server-auth';

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: unknown;
      archived?: unknown;
      version?: unknown;
      careGroupId?: string;
    };
    await requireMembership(request, body.careGroupId || '');
    const parsed = personArchiveSchema.safeParse(body);
    if (!parsed.success) return error('Solicitud inválida', 400);
    const result = await getD1()
      .prepare(
        'UPDATE persons SET archived = ?, version = version + 1 WHERE id = ? AND care_group_id = ? AND version = ?',
      )
      .bind(
        parsed.data.archived ? 1 : 0,
        parsed.data.id,
        body.careGroupId,
        parsed.data.version,
      )
      .run();
    if (!result.meta.changes)
      return error('El perfil cambió en otro dispositivo', 409);
    return NextResponse.json({ ok: true });
  } catch (caught) {
    return caught instanceof Error && 'status' in caught
      ? authError(caught)
      : error('No se pudo cambiar el estado del perfil', 500);
  }
}
