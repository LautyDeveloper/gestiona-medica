'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  ClipboardCheck,
  Home,
  Moon,
  Pill,
  Plus,
  Sun,
  Users,
  LogOut,
} from 'lucide-react';
import { useLocalAuth } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { RecordDialog } from '@/components/record-dialog';
import {
  AppointmentsView,
  HomeView,
  MedicationsView,
  TasksView,
} from '@/components/app-views';
import {
  AppError,
  AppLoading,
  ContentLoading,
} from '@/components/app-feedback';
import {
  NoActivePeople,
  Onboarding,
  PeopleManagerDialog,
  PersonDialog,
  type PersonPayload,
} from '@/components/person-profile';
import { PersonSwitcher } from '@/components/person-switcher';
import { GroupView, type NewUserPayload } from '@/components/group-management';
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
import { ApiError, authorizedFetch, requestJson } from '@/lib/client-api';
import type {
  AppData,
  Appointment,
  Entity,
  MedicalTask,
  Medication,
  PeopleData,
  Person,
  PersonSummary,
  Section,
  CareGroup,
  GroupData,
  SessionData,
  AppUser,
} from '@/lib/models';
import { chooseActivePerson } from '@/lib/person-selection';

const ACTIVE_PERSON_KEY = 'activePersonId';
const navItems: { id: Section; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'appointments', label: 'Turnos', icon: CalendarDays },
  { id: 'medications', label: 'Medicamentos', icon: Pill },
  { id: 'tasks', label: 'Pendientes', icon: ClipboardCheck },
  { id: 'group', label: 'Grupo familiar', icon: Users },
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
  group: { title: 'Grupo familiar', eyebrow: 'Espacio compartido' },
};

type RecordValue = Appointment | Medication | MedicalTask;
type DeleteTarget = {
  entity: Entity;
  id: string;
  personId: string;
  label: string;
};

function OrganizerContent() {
  const { logout } = useLocalAuth();
  const [section, setSection] = useState<Section>('home');
  const [groups, setGroups] = useState<CareGroup[]>([]);
  const [sessionUser, setSessionUser] = useState<AppUser | null>(null);
  const [activeGroupId, setActiveGroupId] = useState('');
  const activeGroupIdRef = useRef('');
  const [groupData, setGroupData] = useState<GroupData | null>(null);
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [activePersonId, setActivePersonId] = useState<string | null>(null);
  const activePersonIdRef = useRef<string | null>(null);
  const [data, setData] = useState<AppData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const [dialog, setDialog] = useState<{
    open: boolean;
    entity: Entity;
    value: RecordValue | null;
  }>({ open: false, entity: 'appointment', value: null });
  const [personDialog, setPersonDialog] = useState<{
    open: boolean;
    person: Person | null;
  }>({ open: false, person: null });
  const [managerOpen, setManagerOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<PersonSummary | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const loadPersonData = useCallback(
    async (personId: string, careGroupId = activeGroupIdRef.current) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setContentLoading(true);
      setLoadError('');
      setData(null);
      try {
        const next = await requestJson<AppData>(
          `/api/data?personId=${encodeURIComponent(personId)}&careGroupId=${encodeURIComponent(careGroupId)}`,
          { signal: controller.signal },
        );
        if (
          !controller.signal.aborted &&
          activePersonIdRef.current === personId &&
          activeGroupIdRef.current === careGroupId
        )
          setData(next);
      } catch (error) {
        if (
          !controller.signal.aborted &&
          activePersonIdRef.current === personId &&
          activeGroupIdRef.current === careGroupId
        )
          setLoadError(
            error instanceof Error
              ? error.message
              : 'No se pudo cargar este perfil.',
          );
      } finally {
        if (
          !controller.signal.aborted &&
          activePersonIdRef.current === personId &&
          activeGroupIdRef.current === careGroupId
        )
          setContentLoading(false);
      }
    },
    [],
  );

  const selectPerson = useCallback(
    async (personId: string) => {
      activePersonIdRef.current = personId;
      setActivePersonId(personId);
      window.localStorage.setItem(
        `${ACTIVE_PERSON_KEY}:${activeGroupIdRef.current}`,
        personId,
      );
      await loadPersonData(personId, activeGroupIdRef.current);
    },
    [loadPersonData],
  );

  const loadPeople = useCallback(
    async (careGroupId = activeGroupIdRef.current) => {
      const response = await requestJson<PeopleData>(
        `/api/person?careGroupId=${encodeURIComponent(careGroupId)}`,
      );
      setPeople(response.persons);
      return response.persons;
    },
    [],
  );

  const loadGroup = useCallback(
    async (careGroupId = activeGroupIdRef.current) => {
      const response = await requestJson<GroupData>(
        `/api/groups?careGroupId=${encodeURIComponent(careGroupId)}`,
      );
      if (activeGroupIdRef.current === careGroupId) setGroupData(response);
      return response;
    },
    [],
  );

  const bootstrap = useCallback(async () => {
    setInitialLoading(true);
    setLoadError('');
    try {
      const session = await requestJson<SessionData>('/api/session');
      setSessionUser(session.user);
      setGroups(session.groups);
      const group = session.groups[0];
      if (!group) {
        setPeople([]);
        setInitialLoading(false);
        return;
      }
      activeGroupIdRef.current = group.id;
      setActiveGroupId(group.id);
      const nextPeople = await loadPeople(group.id);
      void loadGroup(group.id);
      const saved = window.localStorage.getItem(
        `${ACTIVE_PERSON_KEY}:${group.id}`,
      );
      const selected = chooseActivePerson(nextPeople, saved);
      if (selected) await selectPerson(selected.id);
      else {
        activePersonIdRef.current = null;
        setActivePersonId(null);
        setData(null);
        window.localStorage.removeItem(ACTIVE_PERSON_KEY);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Intentá nuevamente en unos minutos.',
      );
    } finally {
      setInitialLoading(false);
    }
  }, [loadGroup, loadPeople, selectPerson]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void bootstrap());
    const saved = window.localStorage.getItem('theme') === 'dark';
    document.documentElement.classList.toggle('dark', saved);
    return () => {
      window.cancelAnimationFrame(frame);
      requestRef.current?.abort();
    };
  }, [bootstrap]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible' || !activeGroupIdRef.current)
        return;
      void loadPeople();
      void loadGroup();
      if (activePersonIdRef.current)
        void loadPersonData(activePersonIdRef.current);
    };
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [loadGroup, loadPeople, loadPersonData]);

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
  function openAddPerson() {
    setManagerOpen(false);
    setPersonDialog({ open: true, person: null });
  }
  function openEditPerson(person: Person) {
    setManagerOpen(false);
    setPersonDialog({ open: true, person });
  }

  async function renameGroup(name: string) {
    await requestJson('/api/groups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeGroupIdRef.current, name }),
    });
    const session = await requestJson<SessionData>('/api/session');
    setGroups(session.groups);
    await loadGroup();
    toast.add({ title: 'Grupo actualizado', type: 'success' });
  }

  async function createUser(payload: NewUserPayload) {
    await requestJson('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        careGroupId: activeGroupIdRef.current,
        ...payload,
      }),
    });
    await loadGroup();
    toast.add({
      title: 'Usuario creado',
      description: 'Ya puede iniciar sesión con su nueva cuenta.',
      type: 'success',
    });
  }

  async function resetUserPassword(userId: string, password: string) {
    await requestJson('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        careGroupId: activeGroupIdRef.current,
        userId,
        password,
      }),
    });
    toast.add({
      title: 'Contraseña restablecida',
      description: 'Las sesiones anteriores de ese usuario fueron cerradas.',
      type: 'success',
    });
  }

  async function changeOwnPassword(
    currentPassword: string,
    newPassword: string,
  ) {
    await requestJson('/api/account/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    await logout();
  }

  async function savePerson(payload: PersonPayload) {
    const editing = personDialog.person;
    if (editing) {
      await requestJson('/api/person', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          careGroupId: activeGroupIdRef.current,
          version: editing.version,
          data: payload,
        }),
      });
      await loadPeople();
      if (editing.id === activePersonIdRef.current)
        await loadPersonData(editing.id);
      toast.add({
        title: 'Perfil actualizado',
        description: 'Los datos personales quedaron guardados.',
        type: 'success',
      });
    } else {
      const result = await requestJson<{ id: string }>('/api/person', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          careGroupId: activeGroupIdRef.current,
          data: payload,
        }),
      });
      await loadPeople();
      await selectPerson(result.id);
      toast.add({
        title: 'Perfil creado',
        description:
          'Ya podés cargar información sin mezclarla con otros perfiles.',
        type: 'success',
      });
    }
    setPersonDialog({ open: false, person: null });
  }

  async function changeArchived(person: PersonSummary, archived: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await requestJson('/api/person/archive', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: person.id,
          archived,
          version: person.version,
          careGroupId: activeGroupIdRef.current,
        }),
      });
      const nextPeople = await loadPeople();
      const nextActive = chooseActivePerson(nextPeople);
      if (archived && person.id === activePersonIdRef.current) {
        if (nextActive) await selectPerson(nextActive.id);
        else {
          activePersonIdRef.current = null;
          setActivePersonId(null);
          setData(null);
          window.localStorage.removeItem(ACTIVE_PERSON_KEY);
        }
      } else if (!archived && !activePersonIdRef.current)
        await selectPerson(person.id);
      setArchiveTarget(null);
      toast.add({
        title: archived ? 'Perfil archivado' : 'Perfil restaurado',
        description: archived
          ? 'Su información se conservó y podés restaurarla cuando quieras.'
          : 'La persona volvió a estar disponible en el selector.',
        type: 'success',
      });
    } catch (error) {
      toast.add({
        title: 'No se pudo actualizar el perfil',
        description:
          error instanceof Error ? error.message : 'Intentá nuevamente.',
        type: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  async function save(
    entity: Entity,
    payload: Record<string, unknown>,
    id?: string,
  ) {
    const targetPersonId = activePersonIdRef.current;
    if (!targetPersonId) throw new ApiError('No hay una persona activa');
    await requestJson('/api/data', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity,
        id,
        personId: targetPersonId,
        careGroupId: activeGroupIdRef.current,
        data: payload,
      }),
    });
    if (activePersonIdRef.current === targetPersonId)
      await loadPersonData(targetPersonId);
    await loadPeople();
    toast.add({
      title: id ? 'Cambios guardados' : 'Registro creado',
      description: 'La información quedó guardada en el perfil correcto.',
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
    setDeleteTarget({ entity, id: item.id, personId: item.personId, label });
  }

  async function confirmDelete() {
    if (!deleteTarget || busy) return;
    setBusy(true);
    try {
      await requestJson(
        `/api/data?entity=${deleteTarget.entity}&id=${encodeURIComponent(deleteTarget.id)}&personId=${encodeURIComponent(deleteTarget.personId)}&careGroupId=${encodeURIComponent(activeGroupIdRef.current)}`,
        { method: 'DELETE' },
      );
      if (activePersonIdRef.current === deleteTarget.personId)
        await loadPersonData(deleteTarget.personId);
      await loadPeople();
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

  async function exportBackup() {
    try {
      const response = await authorizedFetch(
        `/api/backup?careGroupId=${encodeURIComponent(activeGroupIdRef.current)}`,
      );
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
        title: 'Respaldo completo descargado',
        description: 'Incluye todas las personas y su información.',
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
      await requestJson(
        `/api/backup?careGroupId=${encodeURIComponent(activeGroupIdRef.current)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: text,
        },
      );
      setRestoreFile(null);
      setManagerOpen(false);
      await bootstrap();
      toast.add({
        title: 'Respaldo restaurado',
        description:
          'Todas las personas y sus datos fueron reemplazados correctamente.',
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

  if (initialLoading) return <AppLoading />;
  if (loadError && people.length === 0)
    return <AppError message={loadError} onRetry={() => void bootstrap()} />;
  if (groups.length === 0)
    return (
      <AppError
        message="No pudimos encontrar el grupo familiar."
        onRetry={() => void bootstrap()}
      />
    );
  const groupCorner = (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl border bg-card p-2 shadow-sm">
      <span className="px-2 text-sm">
        {groups[0]?.name} ·{' '}
        {sessionUser?.userType === 'caregiver' ? 'Cuidador' : 'Abuelo'}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Cerrar sesión"
        onClick={() => void logout()}
      >
        <LogOut />
      </Button>
    </div>
  );
  if (people.length === 0)
    return (
      <>
        {groupCorner}
        <Onboarding onSave={savePerson} />
        <PersonDialog
          person={personDialog.person}
          open={personDialog.open}
          onOpenChange={(open) =>
            setPersonDialog((current) => ({ ...current, open }))
          }
          onSave={savePerson}
        />
      </>
    );
  const activePerson = people.find(
    (person) => person.id === activePersonId && !person.archived,
  );
  const activeGroup = groups.find((group) => group.id === activeGroupId)!;
  if (!activePerson)
    return (
      <>
        {groupCorner}
        <NoActivePeople
          onAdd={openAddPerson}
          onManage={() => setManagerOpen(true)}
        />
        <PersonDialog
          person={personDialog.person}
          open={personDialog.open}
          onOpenChange={(open) =>
            setPersonDialog((current) => ({ ...current, open }))
          }
          onSave={savePerson}
        />
        <PeopleManagerDialog
          people={people}
          open={managerOpen}
          onOpenChange={setManagerOpen}
          onAdd={openAddPerson}
          onEdit={openEditPerson}
          onArchive={setArchiveTarget}
          onRestore={(person) => void changeArchived(person, false)}
          onExport={exportBackup}
          onImport={(file) => {
            setManagerOpen(false);
            setRestoreFile(file);
          }}
        />
        <ArchiveDialog
          person={archiveTarget}
          busy={busy}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={() =>
            archiveTarget && void changeArchived(archiveTarget, true)
          }
        />
        <RestoreDialog
          file={restoreFile}
          busy={busy}
          onCancel={() => setRestoreFile(null)}
          onConfirm={() => void confirmRestore()}
        />
      </>
    );

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
        <div className="mt-auto grid gap-4">
          <div className="rounded-xl border bg-card p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{activeGroup.name}</p>
            <p>
              {sessionUser?.displayName} ·{' '}
              {sessionUser?.userType === 'caregiver' ? 'Cuidador' : 'Abuelo'}
            </p>
          </div>
          <PersonSwitcher
            activePerson={activePerson}
            people={people}
            onSelect={(id) => void selectPerson(id)}
            onAdd={openAddPerson}
            onManage={() => setManagerOpen(true)}
          />
          <button
            className="flex items-center gap-2 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => void logout()}
          >
            <LogOut className="size-4" /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main
        className={`min-h-dvh pb-24 md:ml-64 md:pb-10 ${busy ? 'pointer-events-none opacity-80' : ''}`}
      >
        <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-5 py-3 backdrop-blur-xl sm:px-8 lg:px-12">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {header.eyebrow} · {activeGroup.name} · Perfil activo:{' '}
              {activePerson.name}
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              {section === 'home'
                ? `Hola, ${activePerson.name.split(' ')[0]}`
                : header.title}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="md:hidden">
              <PersonSwitcher
                compact
                activePerson={activePerson}
                people={people}
                onSelect={(id) => void selectPerson(id)}
                onAdd={openAddPerson}
                onManage={() => setManagerOpen(true)}
              />
            </div>
            {header.action && header.entity && (
              <Button
                size="lg"
                className="hidden rounded-xl sm:inline-flex"
                onClick={() => openNew(header.entity!)}
              >
                <Plus />
                {header.action}
              </Button>
            )}
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
            <Button
              variant="outline"
              size="icon-lg"
              aria-label="Cerrar sesión"
              className="rounded-xl bg-card md:hidden"
              onClick={() => void logout()}
            >
              <LogOut />
            </Button>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
          {contentLoading ? (
            <ContentLoading />
          ) : loadError ? (
            <AppError
              message={loadError}
              onRetry={() => void loadPersonData(activePerson.id)}
            />
          ) : data ? (
            <>
              {section === 'home' && (
                <HomeView data={data} navigate={setSection} onNew={openNew} />
              )}{' '}
              {section === 'appointments' && (
                <AppointmentsView
                  items={data.appointments}
                  onNew={() => openNew('appointment')}
                  onEdit={openEdit}
                  onComplete={(item) =>
                    void update('appointment', item, { status: 'Realizado' })
                  }
                  onDelete={(id) => {
                    const item = data.appointments.find(
                      (value) => value.id === id,
                    );
                    if (item) requestDelete('appointment', item);
                  }}
                />
              )}{' '}
              {section === 'medications' && (
                <MedicationsView
                  items={data.medications}
                  onNew={() => openNew('medication')}
                  onEdit={openEdit}
                  onDelete={(id) => {
                    const item = data.medications.find(
                      (value) => value.id === id,
                    );
                    if (item) requestDelete('medication', item);
                  }}
                />
              )}{' '}
              {section === 'tasks' && (
                <TasksView
                  items={data.tasks}
                  onNew={() => openNew('task')}
                  onEdit={openEdit}
                  onComplete={(item) =>
                    void update('task', item, {
                      status:
                        item.status === 'Pendiente'
                          ? 'Completado'
                          : 'Pendiente',
                    })
                  }
                  onDelete={(id) => {
                    const item = data.tasks.find((value) => value.id === id);
                    if (item) requestDelete('task', item);
                  }}
                />
              )}
              {section === 'group' && groupData && (
                <GroupView
                  data={groupData}
                  onRename={renameGroup}
                  onCreateUser={createUser}
                  onResetPassword={resetUserPassword}
                  onChangePassword={changeOwnPassword}
                />
              )}
            </>
          ) : null}
        </div>
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid h-[76px] grid-cols-5 border-t bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
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
        key={`${dialog.entity}-${dialog.value?.id || 'new'}-${dialog.open}-${activePerson.id}`}
        entity={dialog.entity}
        personId={activePerson.id}
        value={dialog.value}
        open={dialog.open}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        onSave={save}
      />
      <PersonDialog
        key={`${personDialog.person?.id || 'new'}-${personDialog.open}`}
        person={personDialog.person}
        open={personDialog.open}
        onOpenChange={(open) =>
          setPersonDialog((current) => ({ ...current, open }))
        }
        onSave={savePerson}
      />
      <PeopleManagerDialog
        people={people}
        open={managerOpen}
        onOpenChange={setManagerOpen}
        onAdd={openAddPerson}
        onEdit={openEditPerson}
        onArchive={setArchiveTarget}
        onRestore={(person) => void changeArchived(person, false)}
        onExport={exportBackup}
        onImport={(file) => {
          setManagerOpen(false);
          setRestoreFile(file);
        }}
      />
      <ArchiveDialog
        person={archiveTarget}
        busy={busy}
        onCancel={() => setArchiveTarget(null)}
        onConfirm={() =>
          archiveTarget && void changeArchived(archiveTarget, true)
        }
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
      <RestoreDialog
        file={restoreFile}
        busy={busy}
        onCancel={() => setRestoreFile(null)}
        onConfirm={() => void confirmRestore()}
      />
    </div>
  );
}

function ArchiveDialog({
  person,
  busy,
  onCancel,
  onConfirm,
}: {
  person: PersonSummary | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const total = person
    ? person.appointmentCount + person.medicationCount + person.taskCount
    : 0;
  return (
    <AlertDialog
      open={Boolean(person)}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Archivar a {person?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {total > 0
              ? `Tiene ${person?.appointmentCount} turnos, ${person?.medicationCount} medicamentos y ${person?.taskCount} pendientes. Se ocultará del selector, pero toda la información quedará conservada.`
              : 'Se ocultará del selector y podrás restaurar el perfil cuando quieras.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={onConfirm}>
            {busy ? 'Archivando…' : 'Archivar perfil'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RestoreDialog({
  file,
  busy,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={Boolean(file)}
      onOpenChange={(open) => {
        if (!open && !busy) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Reemplazar todos los datos?</AlertDialogTitle>
          <AlertDialogDescription>
            El respaldo “{file?.name}” sustituirá todas las personas y su
            información actual. También se aceptan respaldos de Sprint 1.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Restaurando…' : 'Restaurar respaldo'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function MedicalOrganizer() {
  return (
    <Toaster>
      <OrganizerContent />
    </Toaster>
  );
}
