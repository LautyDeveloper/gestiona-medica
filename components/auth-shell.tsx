'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { KeyRound, LogIn, ShieldCheck } from 'lucide-react';
import { AppLoading } from '@/components/app-feedback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type Mode = 'loading' | 'login' | 'bootstrap' | 'authenticated';

export function AuthShell({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [groupName, setGroupName] = useState('Grupo familiar');

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/bootstrap').then((response) =>
        response.json(),
      ) as Promise<{
        setupRequired: boolean;
      }>,
      fetch('/api/session'),
    ])
      .then(async ([status, session]) => {
        if (session.ok) setMode('authenticated');
        else setMode(status.setupRequired ? 'bootstrap' : 'login');
      })
      .catch(() => {
        setError('No pudimos comprobar el acceso. Recargá la página.');
        setMode('login');
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
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 text-foreground">
      <form
        className="w-full max-w-md rounded-3xl border bg-card p-8 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
          {mode === 'bootstrap' ? <ShieldCheck /> : <KeyRound />}
        </div>
        <p className="mt-7 text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">
          Cerca · Acceso familiar
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
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
          <p role="alert" className="mt-4 text-sm text-destructive">
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
