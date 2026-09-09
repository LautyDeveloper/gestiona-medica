'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Check,
  CheckCircle2,
  ClipboardPlus,
  Clock3,
  MapPin,
  Pencil,
  Pill,
  Trash2,
  Download,
  PackagePlus,
  MessageSquareText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  EmptyState,
  FilterBar,
  StatusBadge,
} from '@/components/view-primitives';
import type {
  AppData,
  Appointment,
  MedicalFeedback,
  MedicalTask,
  Medication,
  Section,
} from '@/lib/models';
import { dueLabel, formatDate, formatLongDate } from '@/lib/format';

type EditFn = (value: Appointment | Medication | MedicalTask) => void;

function HomeSummaryCard({
  title,
  count,
  countLabel,
  icon,
  tone,
  children,
  empty,
  onViewAll,
}: {
  title: string;
  count: number;
  countLabel: string;
  icon: ReactNode;
  tone: 'medication' | 'order' | 'task';
  children: ReactNode;
  empty: string;
  onViewAll: () => void;
}) {
  const tones = {
    medication: 'bg-medication/12 text-medication ring-medication/15',
    order: 'bg-order/12 text-order ring-order/15',
    task: 'bg-task/12 text-task ring-task/15',
  };

  return (
    <article className="app-surface flex min-h-64 flex-col rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${tones[tone]}`}
          >
            {icon}
          </span>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {count} {countLabel}
            </p>
          </div>
        </div>
        <button
          onClick={onViewAll}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          aria-label={`Ver ${title.toLocaleLowerCase('es')}`}
        >
          Ver todo <ArrowRight className="size-3.5" />
        </button>
      </div>
      {count > 0 ? (
        <div className="mt-4 divide-y">{children}</div>
      ) : (
        <p className="my-auto py-7 text-sm leading-6 text-muted-foreground">
          {empty}
        </p>
      )}
    </article>
  );
}

export function HomeView({
  data,
  navigate,
  onNew,
}: {
  data: AppData;
  navigate: (section: Section) => void;
  onNew: (entity: 'appointment' | 'medication' | 'task') => void;
}) {
  const appointments = data.appointments
    .filter((a) => a.status === 'Próximo')
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const next = appointments[0];
  const activeMedications = data.medications
    .filter((medication) => medication.active)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const pendingOrders = data.orders
    .filter((order) => order.status === 'pending')
    .sort((a, b) =>
      (a.expirationDate || '9999').localeCompare(b.expirationDate || '9999'),
    );
  const pendingTasks = data.tasks
    .filter((task) => task.status === 'Pendiente')
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  if (
    data.appointments.length === 0 &&
    data.feedback.length === 0 &&
    data.orders.length === 0 &&
    data.medications.length === 0 &&
    data.prescriptions.length === 0 &&
    data.tasks.length === 0
  ) {
    return (
      <div className="page-rise grid min-h-[60dvh] place-items-center">
        <section className="app-surface w-full max-w-2xl rounded-3xl border-dashed p-7 text-center sm:p-10">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <CheckCircle2 className="size-7" />
          </div>
          <p className="mt-5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Perfil nuevo
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
            Todavía no cargaste información de {data.person?.name}.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Empezá por cualquiera de estas opciones. Cada dato quedará guardado
            únicamente en este perfil.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={() => onNew('appointment')}>
              <CalendarDays />
              Primer turno
            </Button>
            <Button variant="outline" onClick={() => onNew('medication')}>
              <Pill />
              Primer medicamento
            </Button>
            <Button variant="outline" onClick={() => onNew('task')}>
              <CheckCircle2 />
              Primer pendiente
            </Button>
          </div>
        </section>
      </div>
    );
  }
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
      <section aria-label="Próximo turno">
        {next ? (
          <article className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-prescription p-6 text-primary-foreground shadow-[var(--shadow-elevated)] ring-1 ring-white/10 sm:p-7">
            <div
              className="absolute -right-12 -top-16 size-52 rounded-full border-[38px] border-primary-foreground/[.07]"
              aria-hidden="true"
            />
            <div className="relative grid gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-primary-foreground/12 px-3 py-1 text-xs font-semibold ring-1 ring-primary-foreground/10">
                    Próximo turno
                  </span>
                  <span className="text-sm text-primary-foreground/75">
                    {formatDate(next.date)}
                  </span>
                </div>
                <h3 className="mt-6 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
                  {next.specialty}
                </h3>
                <p className="mt-1 text-base text-primary-foreground/80">
                  {next.doctor}
                </p>
                <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm">
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
              </div>
              <div className="rounded-2xl bg-primary-foreground/10 p-4 ring-1 ring-primary-foreground/10 backdrop-blur-sm sm:w-64">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-foreground/65">
                  Qué llevar
                </p>
                <p className="mt-2 text-sm leading-6">{next.bring}</p>
              </div>
            </div>
          </article>
        ) : (
          <article className="app-surface grid min-h-52 place-items-center rounded-3xl p-8 text-center">
            <div>
              <CheckCircle2 className="mx-auto size-8 text-primary" />
              <h3 className="mt-3 font-semibold">No hay turnos próximos</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Podés agregar uno desde Turnos.
              </p>
            </div>
          </article>
        )}
      </section>
      <section className="mt-7" aria-labelledby="home-follow-up-title">
        <div className="mb-4">
          <h3
            id="home-follow-up-title"
            className="text-lg font-semibold tracking-tight"
          >
            En seguimiento
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            El estado actual, sin entrar en cada sección
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <HomeSummaryCard
            title="Medicamentos"
            count={activeMedications.length}
            countLabel={activeMedications.length === 1 ? 'activo' : 'activos'}
            icon={<Pill className="size-5" />}
            tone="medication"
            empty="No hay tratamientos activos."
            onViewAll={() => navigate('medications')}
          >
            {activeMedications.slice(0, 2).map((medication) => (
              <div key={medication.id} className="py-3 first:pt-1 last:pb-0">
                <p className="truncate text-sm font-medium">
                  {medication.name}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {medication.dose} · {medication.frequency}
                </p>
              </div>
            ))}
          </HomeSummaryCard>
          <HomeSummaryCard
            title="Órdenes"
            count={pendingOrders.length}
            countLabel={pendingOrders.length === 1 ? 'pendiente' : 'pendientes'}
            icon={<ClipboardPlus className="size-5" />}
            tone="order"
            empty="No hay órdenes pendientes."
            onViewAll={() => navigate('orders')}
          >
            {pendingOrders.slice(0, 2).map((order) => (
              <div key={order.id} className="py-3 first:pt-1 last:pb-0">
                <p className="truncate text-sm font-medium">
                  {order.specialty}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {order.reason} · Vence {formatDate(order.expirationDate)}
                </p>
              </div>
            ))}
          </HomeSummaryCard>
          <HomeSummaryCard
            title="Pendientes"
            count={pendingTasks.length}
            countLabel={pendingTasks.length === 1 ? 'abierto' : 'abiertos'}
            icon={<CheckCircle2 className="size-5" />}
            tone="task"
            empty="No hay pendientes abiertos."
            onViewAll={() => navigate('tasks')}
          >
            {pendingTasks.slice(0, 2).map((task) => (
              <div key={task.id} className="py-3 first:pt-1 last:pb-0">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {dueLabel(task.dueDate)} · {task.priority}
                </p>
              </div>
            ))}
          </HomeSummaryCard>
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
  onExport,
  onExportOne,
  onFeedback,
}: {
  items: Appointment[];
  onNew: () => void;
  onEdit: EditFn;
  onComplete: (item: Appointment) => void;
  onDelete: (id: string) => void;
  onExport?: () => void;
  onExportOne?: (item: Appointment) => void;
  onFeedback?: (item: Appointment) => void;
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
      {onExport && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onExport}>
            <Download /> Exportar próximos
          </Button>
        </div>
      )}
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
            className="app-surface interactive-surface rounded-2xl border-l-4 border-l-appointment p-5 sm:p-6"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
              <div className="flex min-w-0 flex-1 gap-4">
                <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-appointment/12 py-2 text-appointment ring-1 ring-appointment/15">
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
                {onFeedback && (
                  <Button variant="outline" onClick={() => onFeedback(item)}>
                    <MessageSquareText /> Poner devolución
                  </Button>
                )}
                {item.status === 'Próximo' && onExportOne && (
                  <Button variant="outline" onClick={() => onExportOne(item)}>
                    <CalendarPlus /> Calendario
                  </Button>
                )}
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

export function FeedbackView({
  items,
  appointments,
  onNew,
  onEdit,
  onDelete,
}: {
  items: MedicalFeedback[];
  appointments: Appointment[];
  onNew: () => void;
  onEdit: (item: MedicalFeedback) => void;
  onDelete: (id: string) => void;
}) {
  const appointmentById = new Map(
    appointments.map((appointment) => [appointment.id, appointment]),
  );
  return (
    <div className="page-rise space-y-4">
      {items.length === 0 && (
        <EmptyState
          icon={<MessageSquareText />}
          title="No hay devoluciones cargadas"
          text="Guardá las indicaciones que dio el médico después de una consulta."
          action={onNew}
        />
      )}
      {items.map((item) => {
        const appointment = item.appointmentId
          ? appointmentById.get(item.appointmentId)
          : undefined;
        return (
          <article
            key={item.id}
            className="app-surface interactive-surface rounded-2xl border-l-4 border-l-primary p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold">{item.doctor}</h3>
                  <StatusBadge tone="neutral">
                    {formatDate(item.date)}
                  </StatusBadge>
                </div>
                {appointment && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Turno de {appointment.specialty} · {appointment.time}
                  </p>
                )}
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6">
                  {item.content}
                </p>
              </div>
              <div className="flex shrink-0 justify-end gap-1">
                <Button variant="ghost" onClick={() => onEdit(item)}>
                  <Pencil /> Editar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar devolución de ${item.doctor}`}
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
  onRestock,
  today,
}: {
  items: Medication[];
  onNew: () => void;
  onEdit: EditFn;
  onDelete: (id: string) => void;
  onRestock?: (item: Medication) => void;
  today?: ReactNode;
}) {
  const [filter, setFilter] = useState<'active' | 'inactive'>('active');
  const visible = items.filter((item) => item.active === (filter === 'active'));
  return (
    <div className="page-rise space-y-4">
      {today}
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
            className={`app-surface interactive-surface flex min-h-56 flex-col rounded-2xl border-t-4 border-t-medication p-5 ${!item.active ? 'opacity-65' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="grid size-11 place-items-center rounded-xl bg-medication/12 text-medication ring-1 ring-medication/15">
                <Pill className="size-5" />
              </div>
              <StatusBadge tone={item.active ? 'green' : 'neutral'}>
                {item.active ? 'Activo' : 'Inactivo'}
              </StatusBadge>
            </div>
            <h3 className="mt-5 text-xl font-semibold">{item.name}</h3>
            <p className="mt-1 text-sm font-semibold text-medication">
              {item.dose} · {item.frequency}
            </p>
            {item.scheduleType === 'fixed_times' && (
              <p className="mt-2 text-sm">
                Horarios confirmados: {item.scheduleTimes.join(', ')}
              </p>
            )}
            {item.scheduleType === 'interval' && item.intervalMinutes && (
              <p className="mt-2 text-sm">
                Cada {item.intervalMinutes / 60} horas
              </p>
            )}
            {item.scheduleType === 'as_needed' && (
              <p className="mt-2 text-sm">Según necesidad</p>
            )}
            {item.scheduleType === 'unstructured' && (
              <p className="mt-2 text-xs text-muted-foreground">
                Plan de tomas sin estructurar
              </p>
            )}
            {item.stockQuantity !== null && (
              <p className="mt-2 text-sm text-muted-foreground">
                Cantidad estimada: {item.stockQuantity} {item.stockUnit}
              </p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              Indicado por {item.doctor}
            </p>
            {item.notes && (
              <p className="mt-2 text-sm text-muted-foreground">{item.notes}</p>
            )}
            <div className="mt-auto flex justify-end gap-1 pt-5">
              {onRestock && item.stockUnit && (
                <Button variant="ghost" onClick={() => onRestock(item)}>
                  <PackagePlus /> Reponer
                </Button>
              )}
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
          className={`app-surface interactive-surface flex flex-col gap-4 rounded-2xl border-l-4 border-l-task p-4 sm:flex-row sm:items-center sm:p-5 ${item.status === 'Completado' ? 'opacity-60' : ''}`}
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
