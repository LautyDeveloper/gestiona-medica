import { isPushConfigured } from '@/lib/server-push';
import { runtimeEnv } from '@/lib/runtime-env';

export async function GET() {
  const env = runtimeEnv();
  const configured = isPushConfigured();
  return Response.json({
    configured,
    publicKey: configured ? env.VAPID_PUBLIC_KEY : null,
  });
}
