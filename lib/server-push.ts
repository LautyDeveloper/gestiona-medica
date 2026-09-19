import { buildPushPayload } from '@block65/webcrypto-web-push';
import { getD1 } from '@/db';
import type { AppUser } from '@/lib/models';
import {
  derivePushCandidates,
  pushPayloadForCandidate,
} from '@/lib/push-notifications';
import { loadAlertContextsForUser } from '@/lib/server-alerts';
import { runtimeEnv } from '@/lib/runtime-env';

export type StoredPushSubscription = {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function vapidConfig() {
  const env = runtimeEnv();
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT)
    throw new Error('La configuración VAPID no está completa.');
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };
}

export function isPushConfigured() {
  const env = runtimeEnv();
  return Boolean(
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT,
  );
}

export async function dispatchPushNotifications(now = new Date()) {
  const db = getD1();
  const subscriptions = await db
    .prepare(
      `SELECT ps.id, ps.user_id AS userId, ps.endpoint, ps.p256dh, ps.auth,
         u.username, u.display_name AS displayName, u.user_type AS userType
       FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id
       ORDER BY ps.user_id, ps.created_at`,
    )
    .all<StoredPushSubscription & AppUser>();
  const users = new Map<string, AppUser>();
  for (const row of subscriptions.results)
    users.set(row.userId, {
      id: row.userId,
      username: row.username,
      displayName: row.displayName,
      userType: row.userType,
    });

  let sent = 0;
  let removed = 0;
  let failed = 0;
  for (const user of users.values()) {
    const contexts = await loadAlertContextsForUser(user);
    const candidates = contexts.flatMap((context) =>
      derivePushCandidates(context, now),
    );
    const userSubscriptions = subscriptions.results.filter(
      (item) => item.userId === user.id,
    );
    for (const subscription of userSubscriptions) {
      for (const candidate of candidates) {
        const deliveryId = crypto.randomUUID();
        const attemptedAt = now.toISOString();
        const claim = await db
          .prepare(
            `INSERT OR IGNORE INTO push_deliveries
               (id, subscription_id, alert_key, phase, status,
                scheduled_at, attempted_at, delivered_at)
             VALUES (?, ?, ?, ?, 'claimed', ?, ?, NULL)`,
          )
          .bind(
            deliveryId,
            subscription.id,
            candidate.alert.id,
            candidate.phase,
            candidate.scheduledAt,
            attemptedAt,
          )
          .run();
        if (!claim.meta.changes) continue;

        try {
          const request = await buildPushPayload(
            {
              data: pushPayloadForCandidate(candidate),
              options: { ttl: 3600, urgency: 'high' },
            },
            {
              endpoint: subscription.endpoint,
              expirationTime: null,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            vapidConfig(),
          );
          const response = await fetch(subscription.endpoint, request);
          if (response.status === 404 || response.status === 410) {
            await db
              .prepare('DELETE FROM push_subscriptions WHERE id = ?')
              .bind(subscription.id)
              .run();
            removed += 1;
            break;
          }
          if (!response.ok) throw new Error(`Push service: ${response.status}`);
          await db.batch([
            db
              .prepare(
                `UPDATE push_deliveries
                 SET status = 'sent', delivered_at = ? WHERE id = ?`,
              )
              .bind(new Date().toISOString(), deliveryId),
            db
              .prepare(
                'UPDATE push_subscriptions SET last_success_at = ?, updated_at = ? WHERE id = ?',
              )
              .bind(new Date().toISOString(), new Date().toISOString(), subscription.id),
          ]);
          sent += 1;
        } catch (error) {
          console.error('No se pudo entregar una notificación push', error);
          await db
            .prepare(
              `DELETE FROM push_deliveries
               WHERE id = ? AND status = 'claimed'`,
            )
            .bind(deliveryId)
            .run();
          failed += 1;
        }
      }
    }
  }
  return { sent, removed, failed };
}
