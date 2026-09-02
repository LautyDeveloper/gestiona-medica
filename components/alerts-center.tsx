'use client';

import { useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  FileWarning,
  ListTodo,
  PackageOpen,
  Pill,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import type { Alert, AlertPreferences, AlertsData } from '@/lib/models';
import { Switch } from '@/components/ui/switch';

export type AlertAction =
  | { action: 'read' | 'unread'; alertId: string }
  | { action: 'snooze'; alertId: string; until: string }
  | { action: 'mark-all-read' };

function alertIcon(alert: Alert) {
  if (alert.kind === 'appointment') return <CalendarClock />;
  if (alert.kind === 'task') return <ListTodo />;
  if (alert.kind === 'medication-dose') return <Pill />;
  if (alert.kind === 'medication-stock') return <PackageOpen />;
  return <FileWarning />;
}

function urgencyLabel(alert: Alert) {
  if (alert.kind === 'medication-dose' && alert.urgency === 'overdue')
    return 'Sin registrar';
  if (alert.kind === 'medication-stock') return 'Reposición';
  if (alert.urgency === 'overdue') return 'Vencida';
  if (alert.urgency === 'today') return 'Hoy';
  return 'Próxima';
}

function tomorrow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .split('-')
    .map(Number);
  const next = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 1));
  return `${next.toISOString().slice(0, 10)}T09:00:00-03:00`;
}

export function AlertBell({
  data,
  onAction,
  onViewAll,
}: {
  data: AlertsData | null;
  onAction: (action: AlertAction) => Promise<void>;
  onViewAll: () => void;
}) {
  const active =
    data?.alerts?.filter((alert) => alert.state === 'active') || [];
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className="relative rounded-xl bg-card"
            aria-label={`Alertas${data?.unreadCount ? `, ${data.unreadCount} sin leer` : ''}`}
          />
        }
      >
        {data?.unreadCount ? <BellRing /> : <Bell />}
        {!!data?.unreadCount && (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-5 text-white ring-2 ring-background">
            {data.unreadCount > 99 ? '99+' : data.unreadCount}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] p-3"
      >
        <PopoverHeader className="flex-row items-center justify-between">
          <PopoverTitle>Alertas</PopoverTitle>
          {!!active.length && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onAction({ action: 'mark-all-read' })}
            >
              <Check /> Leer todas
            </Button>
          )}
        </PopoverHeader>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {active.slice(0, 5).map((alert) => (
            <article
              key={alert.id}
              className="rounded-xl border bg-muted/20 p-3"
            >
              <div className="flex gap-3">
                <span className="mt-0.5 text-primary">{alertIcon(alert)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">
                      {alert.title}
                    </p>
                    <Badge
                      variant={
                        alert.urgency === 'overdue' ? 'destructive' : 'outline'
                      }
                    >
                      {urgencyLabel(alert)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {alert.personName} · {alert.detail}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void onAction({ action: 'read', alertId: alert.id })
                      }
                    >
                      Leída
                    </Button>
                    {alert.kind !== 'medication-dose' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void onAction({
                            action: 'snooze',
                            alertId: alert.id,
                            until: tomorrow(),
                          })
                        }
                      >
                        <Clock3 /> Mañana
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
          {!active.length && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Check className="mx-auto mb-2 size-6 text-primary" />
              No hay alertas pendientes.
            </div>
          )}
        </div>
        <Button variant="outline" className="w-full" onClick={onViewAll}>
          Ver todas <ChevronRight />
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function PreferenceField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  options: Array<{ value: number; label: string }>;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <NativeSelect
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={String(option.value)}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </label>
  );
}

export function AlertsView({
  data,
  preferences,
  elder = false,
  onAction,
  onNavigate,
  onSavePreferences,
}: {
  data: AlertsData;
  preferences: AlertPreferences;
  elder?: boolean;
  onAction: (action: AlertAction) => Promise<void>;
  onNavigate: (alert: Alert) => void;
  onSavePreferences: (preferences: AlertPreferences) => Promise<void>;
}) {
  const [filter, setFilter] = useState<'active' | 'snoozed' | 'read'>('active');
  const [draft, setDraft] = useState(preferences);
  const [customDates, setCustomDates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const visible = useMemo(
    () => data.alerts.filter((alert) => alert.state === filter),
    [data.alerts, filter],
  );
  async function savePreferences() {
    setSaving(true);
    try {
      await onSavePreferences(draft);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="page-rise space-y-6">
      <section className="app-surface rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-muted-foreground">
              Fechas importantes de {elder ? 'tu perfil' : 'todo el grupo'}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Centro de alertas
            </h2>
          </div>
          {!!data.alerts.some((alert) => alert.state === 'active') && (
            <Button
              variant="outline"
              onClick={() => void onAction({ action: 'mark-all-read' })}
            >
              <Check /> Marcar todas como leídas
            </Button>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {(['active', 'snoozed', 'read'] as const).map((value) => {
            const labels = {
              active: 'Activas',
              snoozed: 'Pospuestas',
              read: 'Leídas',
            };
            const count = data.alerts.filter(
              (alert) => alert.state === value,
            ).length;
            return (
              <Button
                key={value}
                variant={filter === value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(value)}
              >
                {labels[value]} ({count})
              </Button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-label={`Alertas ${filter}`}>
        {visible.map((alert) => (
          <article
            key={alert.id}
            className={`app-surface rounded-2xl border-l-4 p-5 ${
              alert.urgency === 'overdue'
                ? 'border-l-destructive'
                : alert.urgency === 'today'
                  ? 'border-l-task'
                  : 'border-l-primary'
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                {alertIcon(alert)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{alert.title}</h3>
                  <Badge
                    variant={
                      alert.urgency === 'overdue' ? 'destructive' : 'outline'
                    }
                  >
                    {urgencyLabel(alert)}
                  </Badge>
                </div>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  {alert.personName}
                </p>
                <p className="mt-2 text-sm">{alert.detail}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate(alert)}
                  >
                    Ver registro <ChevronRight />
                  </Button>
                  {alert.state === 'active' && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void onAction({ action: 'read', alertId: alert.id })
                        }
                      >
                        Marcar leída
                      </Button>
                      {alert.kind !== 'medication-dose' && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void onAction({
                                action: 'snooze',
                                alertId: alert.id,
                                until: tomorrow(),
                              })
                            }
                          >
                            Posponer a mañana
                          </Button>
                          <div className="flex items-center gap-2">
                            <input
                              aria-label={`Posponer ${alert.title} hasta una fecha`}
                              type="date"
                              className="h-8 rounded-lg border bg-background px-2 text-sm"
                              value={customDates[alert.id] || ''}
                              onChange={(event) =>
                                setCustomDates((current) => ({
                                  ...current,
                                  [alert.id]: event.target.value,
                                }))
                              }
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={!customDates[alert.id]}
                              onClick={() =>
                                void onAction({
                                  action: 'snooze',
                                  alertId: alert.id,
                                  until: `${customDates[alert.id]}T09:00:00-03:00`,
                                })
                              }
                            >
                              Posponer
                            </Button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  {alert.state === 'read' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void onAction({ action: 'unread', alertId: alert.id })
                      }
                    >
                      Marcar no leída
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
        {!visible.length && (
          <div className="app-surface rounded-3xl border-dashed p-10 text-center text-sm text-muted-foreground">
            No hay alertas en esta vista.
          </div>
        )}
      </section>

      <section className="app-surface rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <Settings2 className="size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Mis anticipos</h2>
            <p className="text-sm text-muted-foreground">
              Elegí cuándo aparece cada tipo de alerta.
            </p>
          </div>
        </div>
        <div
          className={`mt-5 grid gap-4 ${elder ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}
        >
          <PreferenceField
            label="Turnos"
            value={draft.appointmentLeadMinutes}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                appointmentLeadMinutes:
                  value as AlertPreferences['appointmentLeadMinutes'],
              }))
            }
            options={[
              { value: -1, label: 'Desactivadas' },
              { value: 1440, label: '24 horas antes' },
              { value: 2880, label: '48 horas antes' },
              { value: 10080, label: '7 días antes' },
            ]}
          />
          <PreferenceField
            label="Tomas"
            value={draft.medicationLeadMinutes}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                medicationLeadMinutes:
                  value as AlertPreferences['medicationLeadMinutes'],
              }))
            }
            options={[
              { value: -1, label: 'Desactivadas' },
              { value: 0, label: 'A la hora registrada' },
              { value: 15, label: '15 minutos antes' },
              { value: 30, label: '30 minutos antes' },
              { value: 60, label: '1 hora antes' },
            ]}
          />
          <PreferenceField
            label="Pendientes"
            value={draft.taskLeadDays}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                taskLeadDays: value as AlertPreferences['taskLeadDays'],
              }))
            }
            options={[
              { value: -1, label: 'Desactivadas' },
              { value: 0, label: 'El mismo día' },
              { value: 1, label: '1 día antes' },
              { value: 3, label: '3 días antes' },
            ]}
          />
          {!elder && (
            <PreferenceField
              label="Órdenes y recetas"
              value={draft.documentLeadDays}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  documentLeadDays:
                    value as AlertPreferences['documentLeadDays'],
                }))
              }
              options={[
                { value: -1, label: 'Desactivadas' },
                { value: 3, label: '3 días antes' },
                { value: 7, label: '7 días antes' },
                { value: 14, label: '14 días antes' },
              ]}
            />
          )}
          <label
            htmlFor="medication-stock-alerts"
            className="flex min-h-20 items-center justify-between gap-4 rounded-xl border p-3 text-sm font-medium"
          >
            <span>
              Avisos de reposición
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Se basan en la cantidad estimada.
              </span>
            </span>
            <Switch
              id="medication-stock-alerts"
              aria-label="Avisos de reposición"
              checked={draft.medicationStockEnabled}
              onCheckedChange={(checked) =>
                setDraft((current) => ({
                  ...current,
                  medicationStockEnabled: checked,
                }))
              }
            />
          </label>
        </div>
        <Button
          className="mt-5"
          disabled={saving}
          onClick={() => void savePreferences()}
        >
          {saving ? 'Guardando…' : 'Guardar preferencias'}
        </Button>
      </section>
    </div>
  );
}
