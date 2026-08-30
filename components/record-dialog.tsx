'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import type { Appointment, Entity, MedicalTask, Medication } from '@/lib/models';

type RecordValue = Appointment | Medication | MedicalTask;

const emptyValues: Record<Entity, Record<string, unknown>> = {
  appointment: { specialty: '', doctor: '', date: '', time: '', place: '', bring: '', notes: '', status: 'Próximo' },
  medication: { name: '', dose: '', frequency: '', doctor: '', notes: '', active: true },
  task: { title: '', dueDate: '', priority: 'Normal', status: 'Pendiente', notes: '' },
};

const labels: Record<Entity, { new: string; edit: string; description: string }> = {
  appointment: { new: 'Nuevo turno', edit: 'Editar turno', description: 'Guardá la información práctica del turno.' },
  medication: { new: 'Nuevo medicamento', edit: 'Editar medicamento', description: 'Registrá qué medicamento toma actualmente.' },
  task: { new: 'Nuevo pendiente', edit: 'Editar pendiente', description: 'Anotá algo que necesitás resolver.' },
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}{required && <span className="sr-only"> (obligatorio)</span>}{children}</label>;
}

export function RecordDialog({ entity, personId, value, open, onOpenChange, onSave }: { entity: Entity; personId: string; value: RecordValue | null; open: boolean; onOpenChange: (open: boolean) => void; onSave: (entity: Entity, data: Record<string, unknown>, id?: string) => Promise<void> }) {
  const [form, setForm] = useState<Record<string, unknown>>(() => value ? { ...value } : { ...emptyValues[entity], personId });
  const [saving, setSaving] = useState(false);

  const update = (key: string, next: unknown) => setForm((current) => ({ ...current, [key]: next }));
  const text = (key: string) => typeof form[key] === 'string' ? form[key] as string : '';

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setSaving(true);
    try { await onSave(entity, { ...form, personId }, value?.id); onOpenChange(false); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-xl sm:p-6">
        <DialogHeader><DialogTitle className="text-xl">{value ? labels[entity].edit : labels[entity].new}</DialogTitle><DialogDescription>{labels[entity].description}</DialogDescription></DialogHeader>
        <form id="record-form" onSubmit={submit} className="grid gap-4">
          {entity === 'appointment' && <>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Especialidad" required><Input required value={text('specialty')} onChange={(e) => update('specialty', e.target.value)} placeholder="Ej. Cardiología" /></Field><Field label="Médico" required><Input required value={text('doctor')} onChange={(e) => update('doctor', e.target.value)} placeholder="Ej. Dra. Laura Pérez" /></Field></div>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Fecha" required><Input required type="date" value={text('date')} onChange={(e) => update('date', e.target.value)} /></Field><Field label="Hora" required><Input required type="time" value={text('time')} onChange={(e) => update('time', e.target.value)} /></Field></div>
            <Field label="Lugar" required><Input required value={text('place')} onChange={(e) => update('place', e.target.value)} placeholder="Ej. Hospital Italiano" /></Field>
            <Field label="Qué llevar" required><Textarea required value={text('bring')} onChange={(e) => update('bring', e.target.value)} placeholder="DNI, credencial, estudios..." /></Field>
            <Field label="Estado"><NativeSelect className="w-full" value={text('status')} onChange={(e) => update('status', e.target.value)}><NativeSelectOption>Próximo</NativeSelectOption><NativeSelectOption>Realizado</NativeSelectOption><NativeSelectOption>Cancelado</NativeSelectOption></NativeSelect></Field>
          </>}
          {entity === 'medication' && <>
            <Field label="Nombre" required><Input required value={text('name')} onChange={(e) => update('name', e.target.value)} placeholder="Ej. Losartán" /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Dosis" required><Input required value={text('dose')} onChange={(e) => update('dose', e.target.value)} placeholder="Ej. 50 mg" /></Field><Field label="Frecuencia" required><Input required value={text('frequency')} onChange={(e) => update('frequency', e.target.value)} placeholder="Ej. 1 por día" /></Field></div>
            <Field label="Médico que lo indicó" required><Input required value={text('doctor')} onChange={(e) => update('doctor', e.target.value)} placeholder="Ej. Dr. Gómez" /></Field>
            <div className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium"><span>Medicamento activo</span><Switch aria-label="Medicamento activo" checked={Boolean(form.active)} onCheckedChange={(checked) => update('active', checked)} /></div>
          </>}
          {entity === 'task' && <>
            <Field label="Título" required><Input required value={text('title')} onChange={(e) => update('title', e.target.value)} placeholder="Ej. Pedir nueva receta" /></Field>
            <Field label="Fecha límite (opcional)"><Input type="date" value={text('dueDate')} onChange={(e) => update('dueDate', e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Prioridad"><NativeSelect className="w-full" value={text('priority')} onChange={(e) => update('priority', e.target.value)}><NativeSelectOption>Normal</NativeSelectOption><NativeSelectOption>Importante</NativeSelectOption><NativeSelectOption>Urgente</NativeSelectOption></NativeSelect></Field><Field label="Estado"><NativeSelect className="w-full" value={text('status')} onChange={(e) => update('status', e.target.value)}><NativeSelectOption>Pendiente</NativeSelectOption><NativeSelectOption>Completado</NativeSelectOption></NativeSelect></Field></div>
          </>}
          <Field label="Notas (opcional)"><Textarea value={text('notes')} onChange={(e) => update('notes', e.target.value)} placeholder="Agregá una aclaración útil" /></Field>
        </form>
        <DialogFooter className="-mx-5 -mb-5 mt-1 sm:-mx-6 sm:-mb-6"><Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" form="record-form" disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
