'use client';

import { useEffect, useState } from 'react';
import { BellOff, BellRing, LoaderCircle, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  base64UrlToBytes,
  disablePushForCurrentDevice,
  persistPushSubscription,
  pushRegistration,
  supportsWebPush,
} from '@/lib/client-push';
import { requestJson } from '@/lib/client-api';
import type { PushPermissionState } from '@/lib/models';

type PushConfig = { configured: boolean; publicKey: string | null };

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

export function PushNotificationSettings() {
  const [state, setState] = useState<PushPermissionState>('available');
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [iosNeedsInstall, setIosNeedsInstall] = useState(false);

  useEffect(() => {
    let active = true;
    async function inspect() {
      if (!supportsWebPush()) {
        if (active) setState('unsupported');
        return;
      }
      const config = await requestJson<PushConfig>('/api/push/config');
      if (!active) return;
      setConfigured(config.configured);
      setIosNeedsInstall(isIos() && !isStandalone());
      if (Notification.permission === 'denied') {
        setState('blocked');
        return;
      }
      const registration = await pushRegistration();
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await persistPushSubscription(subscription);
        if (active) setState('subscribed');
      } else if (active) setState('available');
    }
    void inspect()
      .catch(() => {
        if (active) setError('No pudimos comprobar las notificaciones.');
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError('');
    try {
      const config = await requestJson<PushConfig>('/api/push/config');
      if (!config.configured || !config.publicKey) {
        setConfigured(false);
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'blocked' : 'available');
        return;
      }
      const registration = await pushRegistration();
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(config.publicKey),
      });
      await persistPushSubscription(subscription);
      setState('subscribed');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudieron activar las notificaciones.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError('');
    try {
      await disablePushForCurrentDevice();
      setState('available');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudieron desactivar las notificaciones.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="app-surface rounded-3xl p-5 sm:p-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Smartphone />
          </span>
          <div>
            <h2 className="font-semibold">Notificaciones en este dispositivo</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Recibí avisos de turnos, pendientes, vencimientos y medicación
              aunque Cerca esté cerrada.
            </p>
          </div>
        </div>
        {state === 'subscribed' ? (
          <Button variant="outline" disabled={busy} onClick={() => void disable()}>
            {busy ? <LoaderCircle className="animate-spin" /> : <BellOff />}
            Desactivar
          </Button>
        ) : (
          <Button
            disabled={
              busy ||
              state === 'unsupported' ||
              state === 'blocked' ||
              !configured ||
              iosNeedsInstall
            }
            onClick={() => void enable()}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <BellRing />}
            Activar notificaciones
          </Button>
        )}
      </div>
      <p className="mt-4 text-sm text-muted-foreground" role="status">
        {!configured &&
          'Las notificaciones todavía no están configuradas en el servidor.'}
        {configured && state === 'subscribed' &&
          'Las notificaciones están activas en este dispositivo.'}
        {configured && state === 'blocked' &&
          'El navegador bloqueó las notificaciones. Podés habilitarlas desde la configuración del sitio.'}
        {configured && state === 'unsupported' &&
          'Este navegador no permite recibir notificaciones push.'}
        {configured && state === 'available' && !iosNeedsInstall &&
          'La activación requiere tu permiso y se aplica sólo a este dispositivo.'}
        {configured && iosNeedsInstall &&
          'En iPhone o iPad, agregá Cerca a la pantalla de inicio y abrila desde allí para activar las notificaciones.'}
      </p>
      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
