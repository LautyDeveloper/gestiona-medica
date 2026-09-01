'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  ClipboardCheck,
  ClipboardPlus,
  Ellipsis,
  FileText,
  Home,
  Pill,
  Plus,
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
  OrdersView,
  PrescriptionsView,
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
  type PersonAccessPayload,
  type PersonPayload,
} from '@/components/person-profile';
import { PersonSwitcher } from '@/components/person-switcher';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { GroupView, type NewUserPayload } from '@/components/group-management';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  MedicalOrder,
  MedicalTask,
  Medication,
  PeopleData,
  Person,
  PersonSummary,
  Prescription,
  Section,
  CareGroup,
  GroupData,
  SessionData,
  AppUser,
} from '@/lib/models';
import { chooseActivePerson } from '@/lib/person-selection';

const ACTIVE_PERSON_KEY = 'activePersonId';
const navItems: {
  id: Section;
  label: string;
  icon: typeof Home;
  activeClass: string;
}[] = [
  {
    id: 'home',
    label: 'Inicio',
    icon: Home,
    activeClass: 'bg-primary/10 text-primary ring-primary/15',
  },
  {
    id: 'appointments',
    label: 'Turnos',
    icon: CalendarDays,
    activeClass: 'bg-appointment/10 text-appointment ring-appointment/15',
  },
  {
    id: 'orders',
    label: 'Órdenes',
    icon: ClipboardPlus,
    activeClass: 'bg-order/10 text-order ring-order/15',
  },
  {
    id: 'medications',
    label: 'Medicamentos',
    icon: Pill,
    activeClass: 'bg-medication/10 text-medication ring-medication/15',
  },
  {
    id: 'prescriptions',
    label: 'Recetas',
    icon: FileText,
    activeClass: 'bg-prescription/10 text-prescription ring-prescription/15',
  },
  {
    id: 'tasks',
    label: 'Pendientes',
    icon: ClipboardCheck,
    activeClass: 'bg-task/10 text-task ring-task/15',
  },
  {
    id: 'group',
    label: 'Grupo familiar',
    icon: Users,
    activeClass: 'bg-primary/10 text-primary ring-primary/15',
  },
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
  orders: {
    title: 'Órdenes',
    eyebrow: 'Indicaciones para sacar turno',
    action: 'Nueva orden',
    entity: 'order',
  },
  medications: {
    title: 'Medicamentos',
    eyebrow: 'Tratamiento actual',
    action: 'Nuevo medicamento',
    entity: 'medication',
  },
  prescriptions: {
    title: 'Recetas',
    eyebrow: 'Indicaciones de medicamentos',
    action: 'Nueva receta',
    entity: 'prescription',
  },
  tasks: {
    title: 'Pendientes',
    eyebrow: 'Cosas por resolver',
    action: 'Nuevo pendiente',
    entity: 'task',
  },
  group: { title: 'Grupo familiar', eyebrow: 'Espacio compartido' },
};

type RecordValue =
  | Appointment
  | MedicalOrder
  | Medication
  | Prescription
  | MedicalTask;
type ConversionSource =
  | { entity: 'order'; item: MedicalOrder }
  | { entity: 'prescription'; item: Prescription };
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
  const backgroundRefreshRef = useRef(false);
  const [dialog, setDialog] = useState<{
    open: boolean;
    entity: Entity;
    value: RecordValue | null;
  }>({ open: false, entity: 'appointment', value: null });
  const [conversion, setConversion] = useState<{
    source: ConversionSource;
    initialData: Record<string, unknown>;
  } | null>(null);
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
    async (
      personId: string,
      careGroupId = activeGroupIdRef.current,
      { background = false }: { background?: boolean } = {},
    ) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      if (!background) {
        setContentLoading(true);
        setLoadError('');
        setData(null);
      }
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
          if (!background)
            setLoadError(
              error instanceof Error
                ? error.message
                : 'No se pudo cargar este perfil.',
            );
      } finally {
        if (
          !background &&
          !controller.signal.aborted &&
          activePersonIdRef.current === personId &&
          activeGroupIdRef.current === careGroupId
        )
          setContentLoading(false);
        if (requestRef.current === controller) requestRef.current = null;
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
    return () => {
      window.cancelAnimationFrame(frame);
      requestRef.current?.abort();
    };
  }, [bootstrap]);

  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || !activeGroupIdRef.current)
        return;
      if (backgroundRefreshRef.current) return;
      backgroundRefreshRef.current = true;
      const personId = activePersonIdRef.current;
      const careGroupId = activeGroupIdRef.current;
      try {
        await Promise.all([
          loadPeople(careGroupId),
          loadGroup(careGroupId),
          personId
            ? loadPersonData(personId, careGroupId, { background: true })
            : Promise.resolve(),
        ]);
      } finally {
        backgroundRefreshRef.current = false;
      }
    };
    const refreshWhenVisible = () => void refresh();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);
    return () => {
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [loadGroup, loadPeople, loadPersonData]);

  function openNew(entity: Entity) {
    setConversion(null);
    setDialog({ open: true, entity, value: null });
  }
  function openEdit(entity: Entity, value: RecordValue) {
    setConversion(null);
    setDialog({ open: true, entity, value });
  }
  function openConversion(source: ConversionSource) {
    const initialData =
      source.entity === 'order'
        ? {
            specialty: source.item.specialty,
            bring: 'Orden médica',
            notes: `Orden solicitada por ${source.item.requestedBy}: ${source.item.reason}`,
          }
        : {
            name: source.item.medicationName,
            dose: source.item.dose,
            frequency: source.item.frequency,
            doctor: source.item.prescribedBy,
            notes: `Presentación: ${source.item.presentation}. Duración indicada: ${source.item.duration}.${source.item.notes ? ` ${source.item.notes}` : ''}`,
            active: true,
          };
    setConversion({ source, initialData });
    setDialog({
      open: true,
      entity: source.entity === 'order' ? 'appointment' : 'medication',
      value: null,
    });
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
      title: 'Cuidador agregado',
      description: 'Ya puede iniciar sesión y administrar el grupo.',
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

  async function savePerson(
    payload: PersonPayload,
    access: PersonAccessPayload,
  ) {
    const editing = personDialog.person;
    const canManageAccess =
      groups.find((group) => group.id === activeGroupIdRef.current)?.role ===
      'admin';
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
      if (canManageAccess && editing.access && !access.enabled) {
        await requestJson('/api/person/access', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            careGroupId: activeGroupIdRef.current,
            personId: editing.id,
          }),
        });
      } else if (canManageAccess && !editing.access && access.enabled) {
        await requestJson('/api/person/access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            careGroupId: activeGroupIdRef.current,
            personId: editing.id,
            username: access.username,
            password: access.password,
          }),
        });
      } else if (canManageAccess && editing.access && access.enabled) {
        await requestJson('/api/person/access', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            careGroupId: activeGroupIdRef.current,
            personId: editing.id,
            username: access.username,
            ...(access.password ? { password: access.password } : {}),
          }),
        });
      }
      await Promise.all([loadPeople(), loadGroup()]);
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
          ...(canManageAccess && access.enabled
            ? {
                access: {
                  username: access.username,
                  password: access.password,
                },
              }
            : {}),
        }),
      });
      await Promise.all([loadPeople(), loadGroup()]);
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

  async function convertDocument(
    _entity: Entity,
    payload: Record<string, unknown>,
  ) {
    if (!conversion) throw new ApiError('No hay un documento para convertir');
    const personId = activePersonIdRef.current;
    if (!personId) throw new ApiError('No hay una persona activa');
    await requestJson('/api/data/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceEntity: conversion.source.entity,
        sourceId: conversion.source.item.id,
        personId,
        careGroupId: activeGroupIdRef.current,
        version: conversion.source.item.version,
        data: payload,
      }),
    });
    await Promise.all([loadPersonData(personId), loadPeople()]);
    toast.add({
      title:
        conversion.source.entity === 'order'
          ? 'Turno creado'
          : 'Medicamento agregado',
      description:
        conversion.source.entity === 'order'
          ? 'La orden quedó vinculada al nuevo turno.'
          : 'La receta quedó vinculada al tratamiento.',
      type: 'success',
    });
    setConversion(null);
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
      'reason' in item
        ? `la orden de ${item.specialty}`
        : 'specialty' in item
          ? `el turno de ${item.specialty}`
          : 'medicationName' in item
            ? `la receta de ${item.medicationName}`
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
      <span className="px-2 text-sm">{groups[0]?.name} · Cuidador</span>
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
        <Onboarding
          onSave={savePerson}
          canManageAccess={groups[0]?.role === 'admin'}
        />
        <PersonDialog
          person={personDialog.person}
          open={personDialog.open}
          onOpenChange={(open) =>
            setPersonDialog((current) => ({ ...current, open }))
          }
          canManageAccess={groups[0]?.role === 'admin'}
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
          canManageAccess={groups[0]?.role === 'admin'}
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
    <div className="min-h-dvh bg-transparent text-foreground" aria-busy={busy}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar/95 px-4 py-6 shadow-[12px_0_45px_-34px_var(--shadow-color)] backdrop-blur-xl md:flex">
        <div className="flex items-center gap-3 px-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-prescription text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-white/15">
            <span className="text-lg font-semibold">C</span>
          </div>
          <div>
            <p className="text-lg font-bold tracking-[-0.03em]">Cerca</p>
            <p className="text-xs font-medium text-muted-foreground">
              Salud en familia
            </p>
          </div>
        </div>
        <nav className="mt-9 space-y-1.5" aria-label="Navegación principal">
          {navItems.map(({ id, label, icon: Icon, activeClass }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-all duration-200 ${section === id ? `${activeClass} shadow-sm ring-1` : 'text-muted-foreground hover:translate-x-0.5 hover:bg-sidebar-accent/70 hover:text-foreground'}`}
            >
              <Icon className="size-[18px]" strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-auto grid gap-4">
          <div className="app-surface rounded-2xl p-3.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">{activeGroup.name}</p>
            <p className="mt-1">{sessionUser?.displayName} · Cuidador</p>
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
        <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b border-border/70 bg-background/78 px-5 py-3 shadow-[0_12px_35px_-32px_var(--shadow-color)] backdrop-blur-xl sm:px-8 lg:px-12">
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="size-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_12%,transparent)]" />
              <span className="truncate">
                {header.eyebrow} · {activeGroup.name} · Perfil activo:{' '}
                {activePerson.name}
              </span>
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-[-0.03em] sm:text-2xl">
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
            <ThemeSwitcher />
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
                  onEdit={(item) => openEdit('appointment', item)}
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
              {section === 'orders' && (
                <OrdersView
                  items={data.orders}
                  onNew={() => openNew('order')}
                  onEdit={(item) => openEdit('order', item)}
                  onConvert={(item) =>
                    openConversion({ entity: 'order', item })
                  }
                  onDelete={(id) => {
                    const item = data.orders.find((value) => value.id === id);
                    if (item) requestDelete('order', item);
                  }}
                />
              )}{' '}
              {section === 'medications' && (
                <MedicationsView
                  items={data.medications}
                  onNew={() => openNew('medication')}
                  onEdit={(item) => openEdit('medication', item)}
                  onDelete={(id) => {
                    const item = data.medications.find(
                      (value) => value.id === id,
                    );
                    if (item) requestDelete('medication', item);
                  }}
                />
              )}{' '}
              {section === 'prescriptions' && (
                <PrescriptionsView
                  items={data.prescriptions}
                  onNew={() => openNew('prescription')}
                  onEdit={(item) => openEdit('prescription', item)}
                  onConvert={(item) =>
                    openConversion({ entity: 'prescription', item })
                  }
                  onDelete={(id) => {
                    const item = data.prescriptions.find(
                      (value) => value.id === id,
                    );
                    if (item) requestDelete('prescription', item);
                  }}
                />
              )}{' '}
              {section === 'tasks' && (
                <TasksView
                  items={data.tasks}
                  onNew={() => openNew('task')}
                  onEdit={(item) => openEdit('task', item)}
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
                  onAddPerson={openAddPerson}
                  onManagePeople={() => setManagerOpen(true)}
                />
              )}
            </>
          ) : null}
        </div>
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid h-[78px] grid-cols-4 border-t border-border/80 bg-card/90 px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-18px_45px_-32px_var(--shadow-color)] backdrop-blur-xl md:hidden"
        aria-label="Navegación principal móvil"
      >
        {navItems
          .filter(({ id }) =>
            (['home', 'appointments', 'medications'] as Section[]).includes(id),
          )
          .map(({ id, label, icon: Icon, activeClass }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={`my-2 flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors ${section === id ? activeClass : 'text-muted-foreground'}`}
            >
              <Icon
                className="size-5"
                strokeWidth={section === id ? 2.2 : 1.8}
              />
              {label}
            </button>
          ))}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={`my-2 flex flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition-colors ${['orders', 'prescriptions', 'tasks', 'group'].includes(section) ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
          >
            <Ellipsis className="size-5" />
            Más
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="mb-2 w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Más secciones</DropdownMenuLabel>
              {navItems
                .filter(({ id }) =>
                  (
                    ['orders', 'prescriptions', 'tasks', 'group'] as Section[]
                  ).includes(id),
                )
                .map(({ id, label, icon: Icon }) => (
                  <DropdownMenuItem key={id} onClick={() => setSection(id)}>
                    <Icon /> {label}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <RecordDialog
        key={`${dialog.entity}-${dialog.value?.id || conversion?.source.item.id || 'new'}-${dialog.open}-${activePerson.id}`}
        entity={dialog.entity}
        personId={activePerson.id}
        value={dialog.value}
        open={dialog.open}
        onOpenChange={(open) => {
          setDialog((current) => ({ ...current, open }));
          if (!open) setConversion(null);
        }}
        onSave={conversion ? convertDocument : save}
        initialData={conversion?.initialData}
      />
      <PersonDialog
        key={`${personDialog.person?.id || 'new'}-${personDialog.open}`}
        person={personDialog.person}
        open={personDialog.open}
        onOpenChange={(open) =>
          setPersonDialog((current) => ({ ...current, open }))
        }
        canManageAccess={activeGroup.role === 'admin'}
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
    ? person.appointmentCount +
      person.orderCount +
      person.medicationCount +
      person.prescriptionCount +
      person.taskCount
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
              ? `Tiene ${total} ${total === 1 ? 'registro' : 'registros'} entre turnos, órdenes, medicamentos, recetas y pendientes. Se ocultará del selector, pero toda la información quedará conservada.`
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
