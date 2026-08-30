'use client';

import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { requestJson } from '@/lib/client-api';

export function InvitationPage({ token }: { token: string }) {
  const [invite, setInvite] = useState<{
    groupName: string;
    inviterName: string;
    status: string;
    expiresAt: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/invitations/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = (await response.json()) as {
          groupName: string;
          inviterName: string;
          status: string;
          expiresAt: string;
          error?: string;
        };
        if (!response.ok) throw new Error(body.error);
        setInvite(body);
      })
      .catch((caught) =>
        setError(
          caught instanceof Error
            ? caught.message
            : 'No se pudo abrir la invitación',
        ),
      );
  }, [token]);
  async function respond(action: 'accept' | 'reject') {
    setBusy(true);
    setError('');
    try {
      await requestJson(`/api/invitations/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      window.location.assign('/');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo responder',
      );
      setBusy(false);
    }
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <section className="w-full max-w-md rounded-3xl border bg-card p-8 text-center">
        <p className="text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">
          Invitación familiar
        </p>
        {error ? (
          <p role="alert" className="mt-5 text-destructive">
            {error}
          </p>
        ) : !invite ? (
          <p className="mt-5">Cargando invitación…</p>
        ) : invite.status !== 'pending' ? (
          <>
            <h1 className="mt-3 text-2xl font-semibold">
              Esta invitación ya no está disponible
            </h1>
            <Button
              className="mt-6"
              onClick={() => window.location.assign('/')}
            >
              Ir a Cerca
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-3 text-2xl font-semibold">
              Sumate a {invite.groupName}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {invite.inviterName} te invitó a compartir la gestión de salud de
              este grupo.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void respond('reject')}
              >
                <X /> Rechazar
              </Button>
              <Button disabled={busy} onClick={() => void respond('accept')}>
                <Check /> Aceptar
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
