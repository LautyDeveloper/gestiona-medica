'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ClipboardCheck, Home, Moon, Pill, Plus, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecordDialog } from '@/components/record-dialog';
import { AppointmentsView, HomeView, MedicationsView, TasksView } from '@/components/app-views';
import { demoData } from '@/lib/demo-data';
import type { AppData, Appointment, Entity, MedicalTask, Medication, Section } from '@/lib/models';

const navItems: { id: Section; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'appointments', label: 'Turnos', icon: CalendarDays },
  { id: 'medications', label: 'Medicamentos', icon: Pill },
  { id: 'tasks', label: 'Pendientes', icon: ClipboardCheck },
];

const headers: Record<Section, { title: string; eyebrow: string; action?: string; entity?: Entity }> = {
  home: { title: 'Hola, Lautaro', eyebrow: 'Domingo, 30 de agosto' },
  appointments: { title: 'Turnos', eyebrow: 'Agenda médica', action: 'Nuevo turno', entity: 'appointment' },
  medications: { title: 'Medicamentos', eyebrow: 'Tratamiento actual', action: 'Nuevo medicamento', entity: 'medication' },
  tasks: { title: 'Pendientes', eyebrow: 'Cosas por resolver', action: 'Nuevo pendiente', entity: 'task' },
};

type RecordValue = Appointment | Medication | MedicalTask;

export function MedicalOrganizer() {
  const [section, setSection] = useState<Section>('home');
  const [data, setData] = useState<AppData>(demoData);
  const [dialog, setDialog] = useState<{ open: boolean; entity: Entity; value: RecordValue | null }>({ open: false, entity: 'appointment', value: null });
  const [message, setMessage] = useState('');

  async function loadData() {
    try {
      const response = await fetch('/api/data');
      if (!response.ok) throw new Error('No se pudieron cargar los datos');
      setData(await response.json());
    } catch { setMessage('No se pudieron sincronizar los cambios. Se muestran los datos de ejemplo.'); }
  }

  useEffect(() => {
    void fetch('/api/data')
      .then((response) => {
        if (!response.ok) throw new Error('No se pudieron cargar los datos');
        return response.json() as Promise<AppData>;
      })
      .then(setData)
      .catch(() => setMessage('No se pudieron sincronizar los cambios. Se muestran los datos de ejemplo.'));
    const saved = window.localStorage.getItem('theme') === 'dark';
    document.documentElement.classList.toggle('dark', saved);
  }, []);

  function toggleTheme() {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  function openNew(entity: Entity) { setDialog({ open: true, entity, value: null }); }
  function openEdit(value: RecordValue) {
    const entity: Entity = 'specialty' in value ? 'appointment' : 'active' in value ? 'medication' : 'task';
    setDialog({ open: true, entity, value });
  }

  async function save(entity: Entity, payload: Record<string, unknown>, id?: string) {
    setMessage('');
    const response = await fetch('/api/data', { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entity, id, data: payload }) });
    if (!response.ok) { setMessage('No se pudo guardar. Intentá nuevamente.'); throw new Error('save failed'); }
    await loadData();
  }

  async function update(entity: Entity, item: RecordValue, changes: Record<string, unknown>) {
    await save(entity, { ...item, ...changes }, item.id);
  }

  async function remove(entity: Entity, id: string) {
    if (!window.confirm('¿Querés eliminar este registro? Esta acción no se puede deshacer.')) return;
    const response = await fetch(`/api/data?entity=${entity}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) { setMessage('No se pudo eliminar. Intentá nuevamente.'); return; }
    await loadData();
  }

  const header = headers[section];
  return <div className="min-h-dvh bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
      <div className="flex items-center gap-3 px-3"><div className="grid size-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><span className="text-lg font-semibold">C</span></div><div><p className="text-lg font-semibold tracking-tight">Cerca</p><p className="text-xs text-muted-foreground">Gestión de salud</p></div></div>
      <nav className="mt-10 space-y-1" aria-label="Navegación principal">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setSection(id)} className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${section === id ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm' : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground'}`}><Icon className="size-[18px]" strokeWidth={1.8}/>{label}</button>)}</nav>
      <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4"><p className="text-xs font-medium text-muted-foreground">Organizando la salud de</p><p className="mt-1 font-semibold">{data.person.name}</p></div>
    </aside>

    <main className="min-h-dvh pb-24 md:ml-64 md:pb-10">
      <header className="sticky top-0 z-20 flex min-h-20 items-center justify-between gap-3 border-b border-border/70 bg-background/85 px-5 py-3 backdrop-blur-xl sm:px-8 lg:px-12">
        <div><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{header.eyebrow}</p><h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">{header.title}</h1></div>
        <div className="flex items-center gap-2">{header.action && header.entity && <Button size="lg" className="rounded-xl" onClick={() => openNew(header.entity!)}><Plus/>{header.action}</Button>}<Button variant="outline" size="icon-lg" aria-label="Cambiar tema" onClick={toggleTheme} className="rounded-xl bg-card"><Moon className="dark:hidden"/><Sun className="hidden dark:block"/></Button></div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
        {message && <output className="mb-5 block rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">{message}</output>}
        {section === 'home' && <HomeView data={data} navigate={setSection}/>} 
        {section === 'appointments' && <AppointmentsView items={data.appointments} onEdit={openEdit} onComplete={(item) => void update('appointment', item, { status: 'Realizado' })} onDelete={(id) => void remove('appointment', id)}/>} 
        {section === 'medications' && <MedicationsView items={data.medications} onEdit={openEdit} onDelete={(id) => void remove('medication', id)}/>} 
        {section === 'tasks' && <TasksView items={data.tasks} onEdit={openEdit} onComplete={(item) => void update('task', item, { status: item.status === 'Pendiente' ? 'Completado' : 'Pendiente' })} onDelete={(id) => void remove('task', id)}/>} 
      </div>
    </main>

    <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[76px] grid-cols-4 border-t bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Navegación principal móvil">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setSection(id)} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${section === id ? 'text-primary' : 'text-muted-foreground'}`}><Icon className="size-5" strokeWidth={section === id ? 2.2 : 1.8}/>{label}</button>)}</nav>
    <RecordDialog key={`${dialog.entity}-${dialog.value?.id || 'new'}-${dialog.open}`} entity={dialog.entity} personId={data.person.id} value={dialog.value} open={dialog.open} onOpenChange={(open) => setDialog((current) => ({ ...current, open }))} onSave={save}/>
  </div>;
}
