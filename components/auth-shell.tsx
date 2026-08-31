'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { KeyRound, LogIn, RefreshCw, ShieldCheck } from 'lucide-react';
import { AppLoading } from '@/components/app-feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { requestJson } from '@/lib/client-api';

type AuthContextValue = { logout: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function useLocalAuth() {
  const value = useContext(AuthContext);
  return (
    value || {
      logout: async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
      },
    }
  );
}

type Mode = 'loading' | 'login' | 'bootstrap' | 'authenticated' | 'error';

async function resolveAccessMode(): Promise<Mode> {
  const bootstrapResponse = await fetch('/api/auth/bootstrap', {
    cache: 'no-store',
  });
  const status = (await bootstrapResponse.json().catch(() => ({}))) as {
    state?: 'setup-required' | 'ready' | 'invalid';
    setupRequired?: boolean;
    error?: string;
    code?: string;
  };
  if (!bootstrapResponse.ok)
    throw new Error(
      status.code === 'DATABASE_UNAVAILABLE'
        ? 'La base de datos no está preparada o no está disponible. Reiniciá la aplicación para aplicar las migraciones.'
        : status.error || 'No pudimos comprobar el acceso.',
    );
  const state =
    status.state ||
    (status.setupRequired === true
      ? 'setup-required'
      : status.setupRequired === false
        ? 'ready'
        : undefined);
  if (!state) throw new Error('La respuesta de acceso no es válida.');
  if (state === 'invalid')
    throw new Error(
      'La configuración de acceso está incompleta. Revisá los usuarios, grupos y permisos de la base local.',
    );
  if (state === 'setup-required') return 'bootstrap';

  const session = await fetch('/api/session', { cache: 'no-store' });
  if (session.ok) return 'authenticated';
  if (session.status === 401) return 'login';
  throw new Error('session');
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [groupName, setGroupName] = useState('Grupo familiar');

  useEffect(() => {
    void resolveAccessMode()
      .then(setMode)
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : 'No pudimos comprobar el acceso. Intentá nuevamente.',
        );
        setMode('error');
      });
  }, []);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await requestJson(
        mode === 'bootstrap' ? '/api/auth/bootstrap' : '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            mode === 'bootstrap'
              ? { username, password, displayName, groupName }
              : { username, password },
          ),
        },
      );
      setMode('authenticated');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo ingresar',
      );
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.assign('/');
  }

  if (mode === 'loading') return <AppLoading />;
  if (mode === 'authenticated')
    return (
      <AuthContext.Provider value={{ logout }}>{children}</AuthContext.Provider>
    );
  if (mode === 'error')
    return (
      <main className="relative grid min-h-dvh place-items-center px-5 py-10 text-foreground">
        <div className="absolute right-5 top-5">
          <ThemeSwitcher />
        </div>
        <section className="app-surface w-full max-w-md rounded-3xl p-8">
          <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-prescription text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-white/15">
            <KeyRound />
          </div>
          <p className="mt-7 text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">
            Cerca · Acceso familiar
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            No pudimos comprobar el acceso
          </h1>
          <p
            role="alert"
            className="mt-3 text-sm leading-6 text-muted-foreground"
          >
            {error}
          </p>
          <Button
            type="button"
            size="lg"
            className="mt-6 w-full"
            onClick={() => {
              setMode('loading');
              setError('');
              void resolveAccessMode()
                .then(setMode)
                .catch((caught) => {
                  setError(
                    caught instanceof Error
                      ? caught.message
                      : 'No pudimos comprobar el acceso. Intentá nuevamente.',
                  );
                  setMode('error');
                });
            }}
          >
            <RefreshCw />
            Reintentar
          </Button>
        </section>
      </main>
    );
  return (
    <main className="relative grid min-h-dvh place-items-center px-5 py-10 text-foreground">
      <div className="absolute right-5 top-5">
        <ThemeSwitcher />
      </div>
      <form
        className="app-surface w-full max-w-md rounded-3xl p-8 sm:p-9"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-prescription text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-white/15">
          {mode === 'bootstrap' ? <ShieldCheck /> : <KeyRound />}
        </div>
        <p className="mt-7 text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">
          Cerca · Acceso familiar
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em]">
          {mode === 'bootstrap'
            ? 'Configurá el primer cuidador'
            : 'Bienvenido de nuevo'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {mode === 'bootstrap'
            ? 'Este usuario podrá crear las demás cuentas de la familia.'
            : 'Ingresá con el usuario que creó tu cuidador.'}
        </p>
        <div className="mt-7 grid gap-4">
          {mode === 'bootstrap' && (
            <>
              <label
                htmlFor="bootstrap-name"
                className="grid gap-2 text-sm font-medium"
              >
                Tu nombre
                <Input
                  id="bootstrap-name"
                  required
                  maxLength={120}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Lautaro"
                />
              </label>
              <label
                htmlFor="bootstrap-group"
                className="grid gap-2 text-sm font-medium"
              >
                Nombre del grupo
                <Input
                  id="bootstrap-group"
                  required
                  maxLength={120}
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                />
              </label>
            </>
          )}
          <label
            htmlFor="login-username"
            className="grid gap-2 text-sm font-medium"
          >
            Usuario
            <Input
              id="login-username"
              required
              autoComplete="username"
              minLength={2}
              maxLength={40}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Lautaro"
            />
          </label>
          <label
            htmlFor="login-password"
            className="grid gap-2 text-sm font-medium"
          >
            Contraseña
            <Input
              id="login-password"
              required
              type="password"
              autoComplete={
                mode === 'bootstrap' ? 'new-password' : 'current-password'
              }
              minLength={mode === 'bootstrap' ? 8 : 1}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive"
          >
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="mt-6 w-full" disabled={busy}>
          <LogIn />
          {busy
            ? 'Guardando…'
            : mode === 'bootstrap'
              ? 'Crear acceso inicial'
              : 'Iniciar sesión'}
        </Button>
      </form>
    </main>
  );
}
