import { NextResponse } from 'next/server';
import { getD1 } from '@/db';
import { personArchiveSchema } from '@/lib/validation';

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request: Request) {
  try {
    const parsed = personArchiveSchema.safeParse(await request.json());
    if (!parsed.success) return error('Solicitud inválida', 400);
    const result = await getD1()
      .prepare('UPDATE persons SET archived = ? WHERE id = ?')
      .bind(parsed.data.archived ? 1 : 0, parsed.data.id)
      .run();
    if (!result.meta.changes) return error('La persona no existe', 404);
    return NextResponse.json({ ok: true });
  } catch {
    return error('No se pudo cambiar el estado del perfil', 500);
  }
}
