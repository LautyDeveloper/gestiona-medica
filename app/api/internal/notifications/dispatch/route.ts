import { dispatchPushNotifications } from '@/lib/server-push';
import { runtimeEnv } from '@/lib/runtime-env';

export async function POST(request: Request) {
  const env = runtimeEnv();
  const secret = env.NOTIFICATION_DISPATCH_SECRET;
  if (
    !secret ||
    request.headers.get('authorization') !== `Bearer ${secret}`
  )
    return Response.json({ error: 'No autorizado' }, { status: 401 });
  try {
    return Response.json(await dispatchPushNotifications());
  } catch (error) {
    console.error('Falló el despacho de notificaciones', error);
    return Response.json(
      { error: 'No se pudieron despachar las notificaciones' },
      { status: 500 },
    );
  }
}
