'use client';

import { useState } from 'react';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  MapPin,
  Pencil,
  Pill,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  AppData,
  Appointment,
  MedicalTask,
  Medication,
  Section,
} from '@/lib/models';
import { dueLabel, formatDate, formatLongDate } from '@/lib/format';

type EditFn = (value: Appointment | Medication | MedicalTask) => void;

function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'green' | 'amber' | 'red';
}) {
  const tones = {
    neutral: 'bg-muted text-muted-foreground',
    green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300',
    red: 'bg-red-500/10 text-red-700 dark:text-red-300',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function HomeView({
  data,
  navigate,
}: {
  data: AppData;
  navigate: (section: Section) => void;
}) {
  const appointments = data.appointments
    .filter((a) => a.status === 'Próximo')
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const next = appointments[0];
  const pending = data.tasks
    .filter((task) => task.status === 'Pendiente')
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
    .slice(0, 4);
  return (
    <div className="page-rise">
      <div className="mb-7">
        <p className="text-sm text-muted-foreground">
          Un vistazo a lo más importante
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
          Todo en orden, de un vistazo.
        </h2>
      </div>
      <section
        className="grid gap-5 lg:grid-cols-[1.35fr_.9fr]"
        aria-label="Resumen principal"
      >
        {next ? (
          <article className="relative overflow-hidden rounded-3xl bg-primary p-6 text-primary-foreground shadow-[0_18px_60px_-34px_rgba(23,72,54,.7)] sm:p-8">
            <div
              className="absolute -right-12 -top-16 size-52 rounded-full border-[38px] border-white/[.05]"
              aria-hidden="true"
            />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-medium">
                  Próximo turno
                </span>
                <span className="text-sm text-white/70">
                  {formatDate(next.date)}
                </span>
              </div>
              <h3 className="mt-8 text-3xl font-semibold tracking-[-0.03em]">
                {next.specialty}
              </h3>
              <p className="mt-1 text-base text-white/75">{next.doctor}</p>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-3 text-sm">
                <span className="flex items-center gap-2 capitalize">
                  <CalendarDays className="size-4" />{' '}
                  {formatLongDate(next.date)}
                </span>
                <span className="flex items-center gap-2">
                  <Clock3 className="size-4" /> {next.time}
                </span>
                <span className="flex items-center gap-2">
                  <MapPin className="size-4" /> {next.place}
                </span>
              </div>
              <div className="mt-7 rounded-2xl bg-black/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">
                  Qué llevar
                </p>
                <p className="mt-2 text-sm leading-6">{next.bring}</p>
              </div>
            </div>
          </article>
        ) : (
          <article className="grid min-h-72 place-items-center rounded-3xl border bg-card p-8 text-center">
            <div>
              <CheckCircle2 className="mx-auto size-8 text-primary" />
              <h3 className="mt-3 font-semibold">No hay turnos próximos</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Podés agregar uno desde Turnos.
              </p>
            </div>
          </article>
        )}
        <article className="rounded-3xl border bg-card p-6 shadow-[0_14px_45px_-34px_rgba(35,58,45,.45)] sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Pendientes próximos</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {pending.length} {pending.length === 1 ? 'cosa' : 'cosas'} por
                resolver
              </p>
            </div>
            <CheckCircle2 className="size-5 text-primary" />
          </div>
          <div className="mt-5 divide-y">
            {pending.map((task) => (
              <div
                key={task.id}
                className="flex gap-3 py-4 first:pt-1 last:pb-0"
              >
                <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full border-2 border-border">
                  <span className="size-1.5 rounded-full bg-primary/50" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-5">{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dueLabel(task.dueDate)} · {task.priority}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {pending.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">
              No hay pendientes abiertos.
            </p>
          )}
        </article>
      </section>
      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h3 className="text-lg font-semibold tracking-tight">
              Próximos turnos
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Lo que sigue después
            </p>
          </div>
          <button
            onClick={() => navigate('appointments')}
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver turnos
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {appointments.slice(1, 3).map((appointment) => (
            <div
              key={appointment.id}
              className="flex items-center gap-4 rounded-2xl border bg-card p-4"
            >
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                <CalendarDays className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{appointment.specialty}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {appointment.doctor} · {formatDate(appointment.date)},{' '}
                  {appointment.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AppointmentsView({
  items,
  onNew,
  onEdit,
  onComplete,
  onDelete,
}: {
  items: Appointment[];
  onNew: () => void;
  onEdit: EditFn;
  onComplete: (item: Appointment) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Appointment['status']>('Próximo');
  const visible = items.filter((item) => item.status === filter);
  const labels: Record<Appointment['status'], string> = {
    Próximo: 'Próximos',
    Realizado: 'Realizados',
    Cancelado: 'Cancelados',
  };
  return (
    <div className="page-rise space-y-4">
      <FilterBar
        values={(['Próximo', 'Realizado', 'Cancelado'] as const).map(
          (value) => ({
            value,
            label: labels[value],
            count: items.filter((item) => item.status === value).length,
          }),
        )}
        active={filter}
        onChange={(value) => setFilter(value as Appointment['status'])}
      />
      {visible.length === 0 && (
        <EmptyState
          icon={<CalendarDays />}
          title={`No hay turnos ${labels[filter].toLowerCase()}`}
          text={
            filter === 'Próximo'
              ? 'Creá un turno para empezar tu agenda.'
              : 'Los turnos con este estado aparecerán acá.'
          }
          action={filter === 'Próximo' ? onNew : undefined}
        />
      )}{' '}
      {visible.map((item) => {
        const [day, month] = formatDate(item.date).split(' ');
        return (
          <article
            key={item.id}
            className="rounded-2xl border bg-card p-5 sm:p-6"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 gap-4">
                <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary py-2 text-primary">
                  <span className="text-xs font-medium uppercase">{month}</span>
                  <span className="text-xl font-semibold">{day}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{item.specialty}</h3>
                    <StatusBadge
                      tone={
                        item.status === 'Próximo'
                          ? 'green'
                          : item.status === 'Cancelado'
                            ? 'red'
                            : 'neutral'
                      }
                    >
                      {item.status}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.doctor}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock3 className="size-4" />
                      {item.time}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4" />
                      {item.place}
                    </span>
                  </div>
                  <p className="mt-3 text-sm">
                    <span className="font-medium">Llevar:</span> {item.bring}
                  </p>
                  {item.notes && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.notes}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                {item.status === 'Próximo' && (
                  <Button variant="secondary" onClick={() => onComplete(item)}>
                    <Check />
                    Realizado
                  </Button>
                )}
                <Button variant="outline" onClick={() => onEdit(item)}>
                  <Pencil />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar turno de ${item.specialty}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function MedicationsView({
  items,
  onNew,
  onEdit,
  onDelete,
}: {
  items: Medication[];
  onNew: () => void;
  onEdit: EditFn;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<'active' | 'inactive'>('active');
  const visible = items.filter((item) => item.active === (filter === 'active'));
  return (
    <div className="page-rise space-y-4">
      <FilterBar
        values={[
          {
            value: 'active',
            label: 'Activos',
            count: items.filter((item) => item.active).length,
          },
          {
            value: 'inactive',
            label: 'Inactivos',
            count: items.filter((item) => !item.active).length,
          },
        ]}
        active={filter}
        onChange={(value) => setFilter(value as typeof filter)}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.length === 0 && (
          <EmptyState
            icon={<Pill />}
            title={`No hay medicamentos ${filter === 'active' ? 'activos' : 'inactivos'}`}
            text={
              filter === 'active'
                ? 'Agregá el primero para empezar tu lista.'
                : 'Los tratamientos finalizados aparecerán acá.'
            }
            action={filter === 'active' ? onNew : undefined}
          />
        )}{' '}
        {visible.map((item) => (
          <article
            key={item.id}
            className={`flex min-h-56 flex-col rounded-2xl border bg-card p-5 ${!item.active ? 'opacity-65' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="grid size-11 place-items-center rounded-xl bg-secondary text-primary">
                <Pill className="size-5" />
              </div>
              <StatusBadge tone={item.active ? 'green' : 'neutral'}>
                {item.active ? 'Activo' : 'Inactivo'}
              </StatusBadge>
            </div>
            <h3 className="mt-5 text-xl font-semibold">{item.name}</h3>
            <p className="mt-1 text-sm font-medium text-primary">
              {item.dose} · {item.frequency}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Indicado por {item.doctor}
            </p>
            {item.notes && (
              <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p>
            )}
            <div className="mt-auto flex justify-end gap-1 pt-5">
              <Button variant="ghost" onClick={() => onEdit(item)}>
                <Pencil />
                Editar
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Eliminar ${item.name}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 />
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function TasksView({
  items,
  onNew,
  onEdit,
  onComplete,
  onDelete,
}: {
  items: MedicalTask[];
  onNew: () => void;
  onEdit: EditFn;
  onComplete: (item: MedicalTask) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<MedicalTask['status']>('Pendiente');
  const visible = items.filter((item) => item.status === filter);
  return (
    <div className="page-rise space-y-3">
      <FilterBar
        values={[
          {
            value: 'Pendiente',
            label: 'Abiertos',
            count: items.filter((item) => item.status === 'Pendiente').length,
          },
          {
            value: 'Completado',
            label: 'Completados',
            count: items.filter((item) => item.status === 'Completado').length,
          },
        ]}
        active={filter}
        onChange={(value) => setFilter(value as MedicalTask['status'])}
      />
      {visible.length === 0 && (
        <EmptyState
          icon={<CheckCircle2 />}
          title={
            filter === 'Pendiente'
              ? 'No hay pendientes abiertos'
              : 'No hay pendientes completados'
          }
          text={
            filter === 'Pendiente'
              ? 'Agregá algo que necesites resolver.'
              : 'Cuando completes algo, aparecerá acá.'
          }
          action={filter === 'Pendiente' ? onNew : undefined}
        />
      )}{' '}
      {visible.map((item) => (
        <article
          key={item.id}
          className={`flex flex-col gap-4 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:p-5 ${item.status === 'Completado' ? 'opacity-60' : ''}`}
        >
          <button
            onClick={() => onComplete(item)}
            className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors ${item.status === 'Completado' ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary'}`}
            aria-label={
              item.status === 'Completado'
                ? 'Reabrir pendiente'
                : 'Marcar como completado'
            }
          >
            {item.status === 'Completado' && <Check className="size-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className={`font-semibold ${item.status === 'Completado' ? 'line-through' : ''}`}
              >
                {item.title}
              </h3>
              <StatusBadge
                tone={
                  item.priority === 'Urgente'
                    ? 'red'
                    : item.priority === 'Importante'
                      ? 'amber'
                      : 'neutral'
                }
              >
                {item.priority}
              </StatusBadge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {dueLabel(item.dueDate)}
              {item.notes ? ` · ${item.notes}` : ''}
            </p>
          </div>
          <div className="flex justify-end gap-1">
            <Button variant="ghost" onClick={() => onEdit(item)}>
              <Pencil />
              Editar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Eliminar ${item.title}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 />
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}

function FilterBar({
  values,
  active,
  onChange,
}: {
  values: { value: string; label: string; count: number }[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      className="flex w-full gap-1 overflow-x-auto rounded-xl bg-muted p-1 sm:w-fit"
      aria-label="Filtrar lista"
    >
      {values.map((item) => (
        <button
          key={item.value}
          onClick={() => onChange(item.value)}
          className={`flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors ${active === item.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          aria-pressed={active === item.value}
        >
          {item.label}
          <span className="rounded-full bg-muted-foreground/10 px-1.5 py-0.5 text-[11px]">
            {item.count}
          </span>
        </button>
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: () => void;
}) {
  return (
    <div className="col-span-full grid min-h-64 place-items-center rounded-3xl border border-dashed bg-card/60 p-8 text-center">
      <div>
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
          {icon}
        </div>
        <h3 className="mt-4 font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{text}</p>
        {action && (
          <Button className="mt-5" onClick={action}>
            Crear ahora
          </Button>
        )}
      </div>
    </div>
  );
}
