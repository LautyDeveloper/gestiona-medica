import { z } from 'zod';
import { getD1 } from '@/db';
import { loadAlertContext } from '@/lib/server-alerts';
import { authError, requireSameOrigin } from '@/lib/server-auth';
import { readJson } from '@/lib/api-response';

const preferencesSchema = z.object({
  appointmentLeadMinutes: z.union([
    z.literal(-1),
    z.literal(1440),
    z.literal(2880),
    z.literal(10080),
  ]),
  taskLeadDays: z.union([
    z.literal(-1),
    z.literal(0),
    z.literal(1),
    z.literal(3),
  ]),
  documentLeadDays: z.union([
    z.literal(-1),
    z.literal(3),
    z.literal(7),
    z.literal(14),
  ]),
});

function groupId(request: Request) {
  return new URL(request.url).searchParams.get('careGroupId') || undefined;
}

export async function GET(request: Request) {
  try {
    const context = await loadAlertContext(request, groupId(request));
    return Response.json({ preferences: context.preferences });
  } catch (error) {
    return authError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const parsed = preferencesSchema.safeParse(await readJson(request));
    if (!parsed.success)
      return Response.json(
        { error: 'Las preferencias no son válidas' },
        { status: 400 },
      );
    const context = await loadAlertContext(request, groupId(request));
    const preferences =
      context.user.userType === 'elder'
        ? {
            ...parsed.data,
            documentLeadDays: context.preferences.documentLeadDays,
          }
        : parsed.data;
    const now = new Date().toISOString();
    await getD1()
      .prepare(
        `INSERT INTO alert_preferences
           (user_id, appointment_lead_minutes, task_lead_days,
            document_lead_days, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           appointment_lead_minutes = excluded.appointment_lead_minutes,
           task_lead_days = excluded.task_lead_days,
           document_lead_days = excluded.document_lead_days,
           updated_at = excluded.updated_at`,
      )
      .bind(
        context.user.id,
        preferences.appointmentLeadMinutes,
        preferences.taskLeadDays,
        preferences.documentLeadDays,
        now,
      )
      .run();
    return Response.json({ preferences });
  } catch (error) {
    return authError(error);
  }
}
