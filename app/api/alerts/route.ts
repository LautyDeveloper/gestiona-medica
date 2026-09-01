import { z } from 'zod';
import { getD1 } from '@/db';
import { alertsForRequest } from '@/lib/server-alerts';
import { authError, requireSameOrigin } from '@/lib/server-auth';
import { readJson } from '@/lib/api-response';

const mutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.enum(['read', 'unread']), alertId: z.string().min(1) }),
  z.object({
    action: z.literal('snooze'),
    alertId: z.string().min(1),
    until: z.iso.datetime({ offset: true }),
  }),
  z.object({ action: z.literal('mark-all-read') }),
]);

function groupId(request: Request) {
  return new URL(request.url).searchParams.get('careGroupId') || undefined;
}

export async function GET(request: Request) {
  try {
    const { alerts } = await alertsForRequest(request, groupId(request));
    return Response.json({
      alerts,
      unreadCount: alerts.filter((alert) => alert.state === 'active').length,
    });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = mutationSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return Response.json(
        { error: 'La acción solicitada no es válida' },
        { status: 400 },
      );
    const now = new Date();
    const nowText = now.toISOString();
    const { context, alerts } = await alertsForRequest(
      request,
      groupId(request),
      now,
    );
    const alertId =
      parsed.data.action === 'mark-all-read' ? null : parsed.data.alertId;
    const targets =
      alertId === null
        ? alerts.filter((alert) => alert.state === 'active')
        : alerts.filter((alert) => alert.id === alertId);
    if (parsed.data.action !== 'mark-all-read' && !targets.length)
      return Response.json(
        { error: 'La alerta ya no está disponible' },
        { status: 404 },
      );

    let readAt: string | null = null;
    let snoozedUntil: string | null = null;
    if (parsed.data.action === 'read' || parsed.data.action === 'mark-all-read')
      readAt = nowText;
    if (parsed.data.action === 'snooze') {
      const until = new Date(parsed.data.until);
      if (until <= now || until.getTime() > now.getTime() + 30 * 86_400_000)
        return Response.json(
          { error: 'Elegí una fecha futura dentro de los próximos 30 días' },
          { status: 400 },
        );
      const alert = targets[0];
      if (alert.kind === 'appointment' && until > new Date(alert.relevantAt))
        return Response.json(
          { error: 'No podés posponer la alerta después del turno' },
          { status: 400 },
        );
      snoozedUntil = until.toISOString();
    }

    if (targets.length) {
      const db = getD1();
      await db.batch(
        targets.map((alert) =>
          db
            .prepare(
              `INSERT INTO alert_states
                 (user_id, alert_key, read_at, snoozed_until, updated_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(user_id, alert_key) DO UPDATE SET
                 read_at = excluded.read_at,
                 snoozed_until = excluded.snoozed_until,
                 updated_at = excluded.updated_at`,
            )
            .bind(
              context.user.id,
              alert.id,
              parsed.data.action === 'unread' ? null : readAt,
              parsed.data.action === 'unread' ? null : snoozedUntil,
              nowText,
            ),
        ),
      );
    }
    return Response.json({ ok: true });
  } catch (error) {
    return authError(error);
  }
}
