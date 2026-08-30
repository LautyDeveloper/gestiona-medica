'use client';

import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { LogIn, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppLoading } from '@/components/app-feedback';
import { Button } from '@/components/ui/button';
import { setAccessTokenProvider } from '@/lib/client-api';

type Config = { domain: string; clientId: string; audience: string };

function Gate({ children }: { children: React.ReactNode }) {
  const {
    isLoading,
    isAuthenticated,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useAuth0();
  useEffect(() => {
    setAccessTokenProvider(
      isAuthenticated ? () => getAccessTokenSilently() : null,
    );
    return () => setAccessTokenProvider(null);
  }, [getAccessTokenSilently, isAuthenticated]);
  if (isLoading) return <AppLoading />;
  if (!isAuthenticated)
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-5 text-foreground">
        <section className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-xl">
          <div className="grid size-12 place-items-center rounded-2xl bg-primary text-xl font-semibold text-primary-foreground">
            C
          </div>
          <p className="mt-7 text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">
            Cerca · Grupo familiar
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Cuidar, ahora en familia
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Ingresá para compartir perfiles, turnos, medicamentos y pendientes
            con las personas que invitaste.
          </p>
          <div className="mt-7 grid gap-3">
            <Button size="lg" onClick={() => void loginWithRedirect()}>
              <LogIn /> Iniciar sesión
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() =>
                void loginWithRedirect({
                  authorizationParams: { screen_hint: 'signup' },
                })
              }
            >
              <UserPlus /> Crear cuenta
            </Button>
          </div>
          <button
            className="mt-5 w-full text-sm text-primary underline-offset-4 hover:underline"
            onClick={() =>
              void loginWithRedirect({
                authorizationParams: { screen_hint: 'login' },
              })
            }
          >
            ¿Olvidaste tu contraseña?
          </button>
        </section>
      </main>
    );
  return children;
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/auth/config')
      .then(async (response) => {
        const body = (await response.json()) as Config & { error?: string };
        if (!response.ok)
          throw new Error(body.error || 'No se pudo configurar el acceso');
        setConfig(body);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : 'No se pudo configurar el acceso',
        ),
      );
  }, []);
  if (error)
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <p
          role="alert"
          className="max-w-md rounded-2xl border bg-card p-6 text-center"
        >
          {error}
        </p>
      </main>
    );
  if (!config) return <AppLoading />;
  return (
    <Auth0Provider
      domain={config.domain}
      clientId={config.clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: config.audience,
        scope: 'openid profile email',
      }}
      cacheLocation="memory"
      useRefreshTokens
    >
      <Gate>{children}</Gate>
    </Auth0Provider>
  );
}
