interface Env {
  CERCA_DISPATCH_URL: string;
  NOTIFICATION_DISPATCH_SECRET: string;
}

async function dispatch(env: Env) {
  const baseUrl = env.CERCA_DISPATCH_URL.replace(/\/$/, '');
  const response = await fetch(
    `${baseUrl}/api/internal/notifications/dispatch`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.NOTIFICATION_DISPATCH_SECRET}`,
      },
    },
  );
  if (!response.ok)
    throw new Error(`Cerca rechazó el despacho (${response.status})`);
}

export default {
  async scheduled(_controller, env, context) {
    context.waitUntil(dispatch(env));
  },
} satisfies ExportedHandler<Env>;
