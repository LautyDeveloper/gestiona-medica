import { z } from 'zod';
import { getD1 } from '@/db';
import { readJson } from '@/lib/api-response';
import { derivePushCandidates } from '@/lib/push-notifications';
import { authError, requireSameOrigin, requireUser } from '@/lib/server-auth';
import { loadAlertContextsForUser } from '@/lib/server-alerts';

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith('https://'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const removalSchema = z.object({ endpoint: z.url().startsWith('https://') });

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser(request);
    const parsed = subscriptionSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return Response.json(
        { error: 'La suscripción push no es válida' },
        { status: 400 },
      );
    const db = getD1();
    const existing = await db
      .prepare('SELECT id, user_id AS userId FROM push_subscriptions WHERE endpoint = ?')
      .bind(parsed.data.endpoint)
      .first<{ id: string; userId: string }>();
    const id = existing?.id || crypto.randomUUID();
    const now = new Date();
    await db
      .prepare(
        `INSERT INTO push_subscriptions
           (id, user_id, endpoint, p256dh, auth, created_at, updated_at, last_success_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
         ON CONFLICT(endpoint) DO UPDATE SET
           user_id = excluded.user_id,
           p256dh = excluded.p256dh,
           auth = excluded.auth,
           updated_at = excluded.updated_at`,
      )
      .bind(
        id,
        user.id,
        parsed.data.endpoint,
        parsed.data.keys.p256dh,
        parsed.data.keys.auth,
        now.toISOString(),
        now.toISOString(),
      )
      .run();

    const isNewForUser = !existing || existing.userId !== user.id;
    if (existing && existing.userId !== user.id)
      await db
        .prepare('DELETE FROM push_deliveries WHERE subscription_id = ?')
        .bind(id)
        .run();
    if (isNewForUser) {
      const contexts = await loadAlertContextsForUser(user);
      const current = contexts.flatMap((context) =>
        derivePushCandidates(context, now),
      );
      if (current.length)
        await db.batch(
          current.map((candidate) =>
            db
              .prepare(
                `INSERT OR IGNORE INTO push_deliveries
                   (id, subscription_id, alert_key, phase, status,
                    scheduled_at, attempted_at, delivered_at)
                 VALUES (?, ?, ?, ?, 'skipped', ?, ?, NULL)`,
              )
              .bind(
                crypto.randomUUID(),
                id,
                candidate.alert.id,
                candidate.phase,
                candidate.scheduledAt,
                now.toISOString(),
              ),
          ),
        );
    }
    return Response.json({ subscribed: true });
  } catch (error) {
    return authError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireUser(request);
    const parsed = removalSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return Response.json(
        { error: 'La suscripción push no es válida' },
        { status: 400 },
      );
    await getD1()
      .prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?')
      .bind(user.id, parsed.data.endpoint)
      .run();
    return Response.json({ subscribed: false });
  } catch (error) {
    return authError(error);
  }
}
