'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Home,
  LogOut,
  MapPin,
  Pill,
  RefreshCw,
  Stethoscope,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { requestJson } from '@/lib/client-api';
import { fullArgentinaDate, splitElderAppointments } from '@/lib/elder-view';
import { formatLongDate } from '@/lib/format';
import type {
  Appointment,
  ElderData,
  ElderSection,
  Medication,
} from '@/lib/models';

const navigation: Array<{
  id: ElderSection;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'appointments', label: 'Turnos', icon: CalendarDays },
  { id: 'medications', label: 'Medicamentos', icon: Pill },
];

function EmptyCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <section className="rounded-3xl border-2 border-dashed bg-card/80 p-7 text-center shadow-sm sm:p-9">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h2 className="mt-4 text-xl font-bold sm:text-2xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-base leading-7 text-muted-foreground">
        {text}
      </p>
    </section>
  );
}

function MedicationCard({ medication }: { medication: Medication }) {
  return (
    <article className="rounded-3xl border-2 border-medication/20 bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-start gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-medication/15 text-medication">
          <Pill className="size-7" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xl font-bold leading-tight sm:text-2xl">
            {medication.name}
          </h3>
          <p className="mt-2 text-lg font-bold text-medication">
            {medication.dose}
          </p>
          <p className="mt-1 text-base font-semibold leading-6">
            {medication.frequency}
          </p>
        </div>
      </div>
      <div className="mt-5 border-t pt-4 text-base leading-7 text-muted-foreground">
        <p>Indicado por {medication.doctor}</p>
        {medication.notes && <p className="mt-2">{medication.notes}</p>}
      </div>
    </article>
  );
}

function AppointmentCard({ appointment }: { appointment: Appointment }) {
  return (
    <article className="rounded-3xl border-2 border-appointment/20 bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
      <div className="flex items-start gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-appointment/15 text-appointment">
          <CalendarDays className="size-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-base font-bold capitalize text-appointment">
              {formatLongDate(appointment.date)}
            </p>
            <span className="rounded-full bg-appointment/10 px-3 py-1 text-sm font-bold text-appointment">
              {appointment.status}
            </span>
          </div>
          <h3 className="mt-1 text-xl font-bold sm:text-2xl">
            {appointment.specialty}
          </h3>
          <p className="mt-1 text-base text-muted-foreground">
            {appointment.doctor}
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 rounded-2xl bg-muted/60 p-4 text-base font-semibold sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <Clock3 className="size-5 text-appointment" /> {appointment.time}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="size-5 text-appointment" /> {appointment.place}
        </p>
      </div>
      <div className="mt-4 text-base leading-7">
        <p>
          <span className="font-bold">Qué llevar:</span> {appointment.bring}
        </p>
        {appointment.notes && (
          <p className="mt-2 text-muted-foreground">{appointment.notes}</p>
        )}
      </div>
    </article>
  );
}

export function ElderApp({ onLogout }: { onLogout: () => Promise<void> }) {
  const [section, setSection] = useState<ElderSection>('home');
  const [data, setData] = useState<ElderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [appointmentView, setAppointmentView] = useState<
    'upcoming' | 'history'
  >('upcoming');
  const [medicationView, setMedicationView] = useState<'active' | 'inactive'>(
    'active',
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await requestJson<ElderData>('/api/elder/data'));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No pudimos cargar tu información.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const appointments = useMemo(
    () => splitElderAppointments(data?.appointments || []),
    [data?.appointments],
  );
  const activeMedications = useMemo(
    () => data?.medications.filter((item) => item.active) || [],
    [data?.medications],
  );
  const inactiveMedications = useMemo(
    () => data?.medications.filter((item) => !item.active) || [],
    [data?.medications],
  );

  if (loading)
    return (
      <main
        className="min-h-dvh bg-gradient-to-b from-primary/10 via-background to-background px-5 py-8"
        aria-label="Cargando mi información"
      >
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-3xl" />
          <Skeleton className="h-48 w-full rounded-3xl" />
        </div>
      </main>
    );

  if (error || !data)
    return (
      <main className="grid min-h-dvh place-items-center bg-gradient-to-b from-primary/10 via-background to-background p-6">
        <section className="w-full max-w-md rounded-3xl border-2 bg-card p-8 text-center shadow-[var(--shadow-elevated)]">
          <RefreshCw className="mx-auto size-12 text-primary" />
          <h1 className="mt-5 text-2xl font-bold">
            No pudimos cargar tus datos
          </h1>
          <p
            role="alert"
            className="mt-3 text-base leading-7 text-muted-foreground"
          >
            {error || 'Intentá nuevamente.'}
          </p>
          <Button
            size="lg"
            className="mt-6 w-full text-base"
            onClick={() => void load()}
          >
            <RefreshCw /> Reintentar
          </Button>
        </section>
      </main>
    );

  const nextAppointment = appointments.upcoming[0];
  const visibleAppointments =
    appointmentView === 'upcoming'
      ? appointments.upcoming
      : appointments.history;
  const visibleMedications =
    medicationView === 'active' ? activeMedications : inactiveMedications;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-primary/10 via-background to-background text-foreground">
      <header className="border-b-2 border-primary/10 bg-card/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-20 max-w-5xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary text-xl font-black text-primary-foreground shadow-md">
              C
            </div>
            <div>
              <p className="text-xl font-black tracking-tight">Cerca</p>
              <p className="text-sm font-semibold text-muted-foreground">
                Mi salud
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Button
              variant="outline"
              size="icon-lg"
              className="rounded-xl bg-card"
              aria-label="Cerrar sesión"
              onClick={() => void onLogout()}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-32 pt-8 sm:px-8 sm:pt-10">
        {section === 'home' && (
          <div className="space-y-9">
            <section>
              <p className="text-base font-semibold capitalize text-muted-foreground">
                {fullArgentinaDate()}
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                Hola, {data.person.name.split(' ')[0]}
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">
                Acá está lo más importante para vos.
              </p>
            </section>

            <section aria-labelledby="next-appointment-title">
              <h2
                id="next-appointment-title"
                className="mb-4 text-2xl font-black tracking-tight"
              >
                Tu próximo turno
              </h2>
              {nextAppointment ? (
                <article className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-primary to-appointment p-6 text-primary-foreground shadow-[var(--shadow-elevated)] sm:p-9">
                  <div className="relative">
                    <p className="text-lg font-bold capitalize text-primary-foreground/85">
                      {formatLongDate(nextAppointment.date)}
                    </p>
                    <h3 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                      {nextAppointment.specialty}
                    </h3>
                    <p className="mt-2 text-lg text-primary-foreground/85">
                      {nextAppointment.doctor}
                    </p>
                    <div className="mt-7 grid gap-3 rounded-2xl bg-primary-foreground/12 p-4 text-lg font-bold ring-1 ring-primary-foreground/15 sm:grid-cols-2">
                      <p className="flex items-center gap-2">
                        <Clock3 className="size-6" /> {nextAppointment.time}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="size-6" /> {nextAppointment.place}
                      </p>
                    </div>
                    <p className="mt-6 text-lg leading-8">
                      <span className="font-black">Tenés que llevar:</span>{' '}
                      {nextAppointment.bring}
                    </p>
                  </div>
                </article>
              ) : (
                <EmptyCard
                  icon={<CheckCircle2 className="size-7" />}
                  title="No tenés turnos próximos"
                  text="Cuando tu cuidador cargue un nuevo turno, lo vas a ver acá."
                />
              )}
              {appointments.upcoming.length > 1 && (
                <Button
                  variant="outline"
                  size="lg"
                  className="mt-4 w-full text-base sm:w-auto"
                  onClick={() => setSection('appointments')}
                >
                  Ver todos mis turnos
                </Button>
              )}
            </section>

            <section aria-labelledby="today-medications-title">
              <div className="mb-4">
                <h2
                  id="today-medications-title"
                  className="text-2xl font-black tracking-tight"
                >
                  Tus medicamentos
                </h2>
                <p className="mt-1 text-base text-muted-foreground">
                  Estos son tus tratamientos activos.
                </p>
              </div>
              {activeMedications.length ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {activeMedications.map((medication) => (
                    <MedicationCard
                      key={medication.id}
                      medication={medication}
                    />
                  ))}
                </div>
              ) : (
                <EmptyCard
                  icon={<Pill className="size-7" />}
                  title="No tenés medicamentos activos"
                  text="Si tu tratamiento cambia, la información actualizada aparecerá acá."
                />
              )}
            </section>
          </div>
        )}

        {section === 'appointments' && (
          <section aria-labelledby="appointments-title">
            <p className="text-base font-semibold text-appointment">
              Tu agenda médica
            </p>
            <h1
              id="appointments-title"
              className="mt-1 text-3xl font-black tracking-tight sm:text-4xl"
            >
              Mis turnos
            </h1>
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5">
              <button
                className={`min-h-12 rounded-xl px-3 text-base font-bold ${appointmentView === 'upcoming' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setAppointmentView('upcoming')}
              >
                Próximos ({appointments.upcoming.length})
              </button>
              <button
                className={`min-h-12 rounded-xl px-3 text-base font-bold ${appointmentView === 'history' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setAppointmentView('history')}
              >
                Anteriores ({appointments.history.length})
              </button>
            </div>
            <div className="mt-6 grid gap-4">
              {visibleAppointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                />
              ))}
              {!visibleAppointments.length && (
                <EmptyCard
                  icon={<CalendarDays className="size-7" />}
                  title={
                    appointmentView === 'upcoming'
                      ? 'No tenés turnos próximos'
                      : 'No hay turnos anteriores'
                  }
                  text="La información de tus turnos aparecerá en esta sección."
                />
              )}
            </div>
          </section>
        )}

        {section === 'medications' && (
          <section aria-labelledby="medications-title">
            <p className="text-base font-semibold text-medication">
              Tu tratamiento
            </p>
            <h1
              id="medications-title"
              className="mt-1 text-3xl font-black tracking-tight sm:text-4xl"
            >
              Mis medicamentos
            </h1>
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5">
              <button
                className={`min-h-12 rounded-xl px-3 text-base font-bold ${medicationView === 'active' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setMedicationView('active')}
              >
                Activos ({activeMedications.length})
              </button>
              <button
                className={`min-h-12 rounded-xl px-3 text-base font-bold ${medicationView === 'inactive' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                onClick={() => setMedicationView('inactive')}
              >
                Anteriores ({inactiveMedications.length})
              </button>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {visibleMedications.map((medication) => (
                <MedicationCard key={medication.id} medication={medication} />
              ))}
              {!visibleMedications.length && (
                <EmptyCard
                  icon={<Stethoscope className="size-7" />}
                  title={
                    medicationView === 'active'
                      ? 'No tenés medicamentos activos'
                      : 'No hay tratamientos anteriores'
                  }
                  text="La información de tus medicamentos aparecerá en esta sección."
                />
              )}
            </div>
          </section>
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-primary/15 bg-card/95 px-3 pb-[env(safe-area-inset-bottom)] shadow-[0_-18px_45px_-32px_var(--shadow-color)] backdrop-blur-xl"
        aria-label="Navegación de mi salud"
      >
        <div className="mx-auto grid h-20 max-w-lg grid-cols-3 gap-1">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={section === id ? 'page' : undefined}
              className={`my-2 flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-sm font-bold ${section === id ? 'bg-primary/12 text-primary' : 'text-muted-foreground'}`}
              onClick={() => setSection(id)}
            >
              <Icon className="size-6" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
