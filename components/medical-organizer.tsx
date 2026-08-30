'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  ClipboardCheck,
  Home,
  Moon,
  Pencil,
  Pill,
  Plus,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecordDialog } from '@/components/record-dialog';
import {
  AppointmentsView,
  HomeView,
  MedicationsView,
  TasksView,
} from '@/components/app-views';
import { AppError, AppLoading } from '@/components/app-feedback';
import { Onboarding, ProfileDialog } from '@/components/person-profile';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Toaster, toast } from '@/components/ui/toast';
import { ApiError, requestJson } from '@/lib/client-api';
import type {
  AppData,
  Appointment,
  Entity,
  MedicalTask,
  Medication,
  Person,
  Section,
} from '@/lib/models';

const navItems: { id: Section; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'appointments', label: 'Turnos', icon: CalendarDays },
  { id: 'medications', label: 'Medicamentos', icon: Pill },
  { id: 'tasks', label: 'Pendientes', icon: ClipboardCheck },
];

const headers: Record<
  Section,
  { title: string; eyebrow: string; action?: string; entity?: Entity }
> = {
  home: { title: 'Inicio', eyebrow: 'Resumen de hoy' },
  appointments: {
    title: 'Turnos',
    eyebrow: 'Agenda médica',
    action: 'Nuevo turno',
    entity: 'appointment',
  },
  medications: {
    title: 'Medicamentos',
    eyebrow: 'Tratamiento actual',
    action: 'Nuevo medicamento',
    entity: 'medication',
  },
  tasks: {
    title: 'Pendientes',
    eyebrow: 'Cosas por resolver',
    action: 'Nuevo pendiente',
    entity: 'task',
  },
};

type RecordValue = Appointment | Medication | MedicalTask;
type DeleteTarget = { entity: Entity; id: string; label: string };
type PersonPayload = Omit<Person, 'id'>;

function OrganizerContent() {
  const [section, setSection] = useState<Section>('home');
  const [data, setData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{
    open: boolean;
    entity: Entity;
    value: RecordValue | null;
  }>({ open: false, entity: 'appointment', value: null });
  const [profileOpen, setProfileOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setData(await requestJson<AppData>('/api/data'));
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Intentá nuevamente en unos minutos.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadData());
    const saved = window.localStorage.getItem('theme') === 'dark';
    document.documentElement.classList.toggle('dark', saved);
    return () => window.cancelAnimationFrame(frame);
  }, [loadData]);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  function openNew(entity: Entity) {
    setDialog({ open: true, entity, value: null });
  }
  function openEdit(value: RecordValue) {
    const entity: Entity =
      'specialty' in value
        ? 'appointment'
        : 'active' in value
          ? 'medication'
          : 'task';
    setDialog({ open: true, entity, value });
  }

  async function save(
    entity: Entity,
    payload: Record<string, unknown>,
    id?: string,
  ) {
    await requestJson('/api/data', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity, id, data: payload }),
    });
    await loadData();
    toast.add({
      title: id ? 'Cambios guardados' : 'Registro creado',
      description: 'La información quedó actualizada.',
      type: 'success',
    });
  }

  async function update(
    entity: Entity,
    item: RecordValue,
    changes: Record<string, unknown>,
  ) {
    if (busy) return;
    setBusy(true);
    try {
      await save(entity, { ...item, ...changes }, item.id);
    } catch (error) {
      toast.add({
        title: 'No se pudo actualizar',
        description:
          error instanceof Error ? error.message : 'Intentá nuevamente.',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  function requestDelete(entity: Entity, item: RecordValue) {
    const label =
      'specialty' in item
        ? `el turno de ${item.specialty}`
        : 'active' in item
          ? item.name
          : item.title;
    setDeleteTarget({ entity, id: item.id, label });
  }

  async function confirmDelete() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await requestJson(
        `/api/data?entity=${deleteTarget.entity}&id=${encodeURIComponent(deleteTarget.id)}`,
        { method: 'DELETE' },
      );
      await loadData();
      setDeleteTarget(null);
      toast.add({
        title: 'Registro eliminado',
        description: 'La información se eliminó correctamente.',
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'No se pudo eliminar',
        description:
          error instanceof Error ? error.message : 'Intentá nuevamente.',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function savePerson(payload: PersonPayload) {
    const editing = Boolean(data?.person);
    await requestJson('/api/person', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await loadData();
    setProfileOpen(false);
    toast.add({
      title: editing ? 'Perfil actualizado' : 'Todo listo para empezar',
      description: editing
        ? 'Los datos personales quedaron guardados.'
        : 'Ya podés cargar información real.',
      type: 'success',
    });
  }

  async function exportBackup() {
    try {
      const response = await fetch('/api/backup');
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new ApiError(payload.error || 'No se pudo crear el respaldo');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `cerca-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.add({
        title: 'Respaldo descargado',
        description: 'Guardalo en un lugar seguro.',
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'No se pudo exportar',
        description:
          error instanceof Error ? error.message : 'Intentá nuevamente.',
        type: 'error',
      });
    }
  }

  async function confirmRestore() {
    if (!restoreFile || busy) return;
    setBusy(true);
    try {
      if (restoreFile.size > 5_000_000)
        throw new ApiError('El archivo supera el límite de 5 MB');
      const text = await restoreFile.text();
      JSON.parse(text);
      await requestJson('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: text,
      });
      await loadData();
      setRestoreFile(null);
      toast.add({
        title: 'Respaldo restaurado',
        description: 'Todos los datos fueron reemplazados correctamente.',
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'No se pudo restaurar',
        description:
          error instanceof SyntaxError
            ? 'El archivo no contiene JSON válido.'
            : error instanceof Error
              ? error.message
              : 'El archivo no es válido.',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <AppLoading />;
  if (loadError && !data)
    return <AppError message={loadError} onRetry={() => void loadData()} />;
  if (!data) return null;
  if (!data.person) return <Onboarding onSave={savePerson} />;

  const person = data.person;
  const header = headers[section];
  return (
    <div className="min-h-dvh bg-background text-foreground" aria-busy={busy}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
        <div className="flex items-center gap-3 px-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <span className="text-lg font-semibold">C</span>
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">Cerca</p>
            <p className="text-xs text-muted-foreground">Gestión de salud</p>
          </div>
        </div>
        <nav className="mt-10 space-y-1" aria-label="Navegación principal">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${section === id ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground'}`}
            >
              <Icon className="size-[18px]" strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </nav>
        <button
          onClick={() => setProfileOpen(true)}
          className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4 text-left transition-colors hover:bg-sidebar-accent"
        >
          <p className="text-xs font-medium text-muted-foreground">
            Organizando la salud de
          </p>
          <span className="mt-1 flex items-center justify-between font-semibold">
            {person.name}
            <Pencil className="size-4 text-muted-foreground" />
          </span>
        </button>
      </aside>
      <main
        className={`min-h-dvh pb-24 md:ml-64 md:pb-10 ${busy ? 'pointer-events-none opacity-80' : ''}`}
      >
        <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-5 py-3 backdrop-blur-xl sm:px-8 lg:px-12">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {header.eyebrow}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              {section === 'home'
                ? `Hola, ${person.name.split(' ')[0]}`
                : header.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {header.action && header.entity && (
              <Button
                size="lg"
                className="rounded-xl"
                onClick={() => openNew(header.entity!)}
              >
                <Plus />
                {header.action}
              </Button>
            )}
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Editar perfil"
              onClick={() => setProfileOpen(true)}
              className="rounded-xl bg-card md:hidden"
            >
              <Pencil />
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Cambiar tema"
              onClick={toggleTheme}
              className="rounded-xl bg-card"
            >
              <Moon className="dark:hidden" />
              <Sun className="hidden dark:block" />
            </Button>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
          {loadError && (
            <button
              onClick={() => void loadData()}
              className="mb-5 block w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-sm text-amber-800 dark:text-amber-200"
            >
              No se pudieron actualizar los datos. Tocá para reintentar.
            </button>
          )}
          {section === 'home' && <HomeView data={data} navigate={setSection} />}
          {section === 'appointments' && (
            <AppointmentsView
              items={data.appointments}
              onNew={() => openNew('appointment')}
              onEdit={openEdit}
              onComplete={(item) =>
                void update('appointment', item, { status: 'Realizado' })
              }
              onDelete={(id) => {
                const item = data.appointments.find((value) => value.id === id);
                if (item) requestDelete('appointment', item);
              }}
            />
          )}
          {section === 'medications' && (
            <MedicationsView
              items={data.medications}
              onNew={() => openNew('medication')}
              onEdit={openEdit}
              onDelete={(id) => {
                const item = data.medications.find((value) => value.id === id);
                if (item) requestDelete('medication', item);
              }}
            />
          )}
          {section === 'tasks' && (
            <TasksView
              items={data.tasks}
              onNew={() => openNew('task')}
              onEdit={openEdit}
              onComplete={(item) =>
                void update('task', item, {
                  status:
                    item.status === 'Pendiente' ? 'Completado' : 'Pendiente',
                })
              }
              onDelete={(id) => {
                const item = data.tasks.find((value) => value.id === id);
                if (item) requestDelete('task', item);
              }}
            />
          )}
        </div>
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid h-[76px] grid-cols-4 border-t bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Navegación principal móvil"
      >
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${section === id ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Icon className="size-5" strokeWidth={section === id ? 2.2 : 1.8} />
            {label}
          </button>
        ))}
      </nav>
      <RecordDialog
        key={`${dialog.entity}-${dialog.value?.id || 'new'}-${dialog.open}`}
        entity={dialog.entity}
        personId={person.id}
        value={dialog.value}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        onSave={save}
      />
      <ProfileDialog
        key={`${person.id}-${profileOpen}`}
        person={person}
        open={profileOpen}
        onOpenChange={setProfileOpen}
        onSave={savePerson}
        onExport={exportBackup}
        onImport={(file) => {
          setProfileOpen(false);
          setRestoreFile(file);
        }}
      />
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar {deleteTarget?.label}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => void confirmDelete()}
            >
              {busy ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(restoreFile)}
        onOpenChange={(open) => {
          if (!open && !busy) setRestoreFile(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reemplazar todos los datos?</AlertDialogTitle>
            <AlertDialogDescription>
              El respaldo “{restoreFile?.name}” sustituirá el perfil, los
              turnos, medicamentos y pendientes actuales. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={() => void confirmRestore()}
            >
              {busy ? 'Restaurando…' : 'Restaurar respaldo'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function MedicalOrganizer() {
  return (
    <Toaster>
      <OrganizerContent />
    </Toaster>
  );
}
