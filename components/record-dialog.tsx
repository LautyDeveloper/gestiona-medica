'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import type {
  Appointment,
  Entity,
  MedicalOrder,
  MedicalTask,
  Medication,
  Prescription,
} from '@/lib/models';
import { ApiError } from '@/lib/client-api';
import { normalizeAppointmentTime, recordSchemas } from '@/lib/validation';

type RecordValue =
  | Appointment
  | MedicalOrder
  | Medication
  | Prescription
  | MedicalTask;

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const emptyValues: Record<Entity, Record<string, unknown>> = {
  appointment: {
    specialty: '',
    doctor: '',
    date: '',
    time: '',
    place: '',
    bring: '',
    notes: '',
    status: 'Próximo',
  },
  order: {
    specialty: '',
    reason: '',
    requestedBy: '',
    issueDate: today,
    expirationDate: '',
    notes: '',
  },
  medication: {
    name: '',
    dose: '',
    frequency: '',
    doctor: '',
    notes: '',
    active: true,
  },
  prescription: {
    medicationName: '',
    presentation: '',
    dose: '',
    frequency: '',
    duration: '',
    prescribedBy: '',
    issueDate: today,
    expirationDate: '',
    notes: '',
  },
  task: {
    title: '',
    dueDate: '',
    priority: 'Normal',
    status: 'Pendiente',
    notes: '',
    visibleToElder: false,
  },
};

const labels: Record<
  Entity,
  { new: string; edit: string; description: string }
> = {
  appointment: {
    new: 'Nuevo turno',
    edit: 'Editar turno',
    description: 'Guardá la información práctica del turno.',
  },
  order: {
    new: 'Nueva orden médica',
    edit: 'Editar orden médica',
    description: 'Registrá la indicación antes de sacar el turno.',
  },
  medication: {
    new: 'Nuevo medicamento',
    edit: 'Editar medicamento',
    description: 'Registrá qué medicamento toma actualmente.',
  },
  prescription: {
    new: 'Nueva receta',
    edit: 'Editar receta',
    description: 'Guardá la indicación y controlá su vencimiento.',
  },
  task: {
    new: 'Nuevo pendiente',
    edit: 'Editar pendiente',
    description: 'Anotá algo que necesitás resolver.',
  },
};

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {required && (
        <span className="text-destructive" aria-hidden="true">
          {' '}
          *
        </span>
      )}
      {children}
      {error && (
        <span className="text-xs font-normal text-destructive">{error}</span>
      )}
    </label>
  );
}

export function RecordDialog({
  entity,
  personId,
  value,
  open,
  onOpenChange,
  onSave,
  initialData,
  canShowToElder = false,
}: {
  entity: Entity;
  personId: string;
  value: RecordValue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    entity: Entity,
    data: Record<string, unknown>,
    id?: string,
  ) => Promise<void>;
  initialData?: Record<string, unknown>;
  canShowToElder?: boolean;
}) {
  const [form, setForm] = useState<Record<string, unknown>>(() =>
    value ? { ...value } : { ...emptyValues[entity], ...initialData, personId },
  );
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const update = (key: string, next: unknown) =>
    setForm((current) => ({ ...current, [key]: next }));
  const text = (key: string) =>
    typeof form[key] === 'string' ? (form[key] as string) : '';

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setErrors({});
    setFormError('');
    const parsed = recordSchemas[entity].safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        if (typeof issue.path[0] === 'string' && !next[issue.path[0]])
          next[issue.path[0]] = issue.message;
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      await onSave(entity, { ...parsed.data, personId }, value?.id);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.details)
        setErrors(
          Object.fromEntries(
            Object.entries(error.details).map(([key, messages]) => [
              key,
              messages[0] || 'Valor inválido',
            ]),
          ),
        );
      setFormError(
        error instanceof Error ? error.message : 'No se pudo guardar',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {value ? labels[entity].edit : labels[entity].new}
          </DialogTitle>
          <DialogDescription>{labels[entity].description}</DialogDescription>
        </DialogHeader>
        <form id="record-form" onSubmit={submit} className="grid gap-4">
          {formError && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
          )}
          {entity === 'appointment' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Especialidad" required error={errors.specialty}>
                  <Input
                    required
                    value={text('specialty')}
                    onChange={(e) => update('specialty', e.target.value)}
                    placeholder="Ej. Cardiología"
                  />
                </Field>
                <Field label="Médico" required error={errors.doctor}>
                  <Input
                    required
                    value={text('doctor')}
                    onChange={(e) => update('doctor', e.target.value)}
                    placeholder="Ej. Dra. Laura Pérez"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fecha" required error={errors.date}>
                  <Input
                    required
                    type="date"
                    value={text('date')}
                    onChange={(e) => update('date', e.target.value)}
                  />
                </Field>
                <Field label="Hora" required error={errors.time}>
                  <Input
                    required
                    inputMode="text"
                    value={text('time')}
                    onChange={(e) => update('time', e.target.value)}
                    onBlur={() =>
                      update('time', normalizeAppointmentTime(text('time')))
                    }
                    placeholder="Ej. 14:00 o 2 pm"
                  />
                  <span className="text-xs font-normal text-muted-foreground">
                    Formato de 24 horas. También podés escribir “2 pm”.
                  </span>
                </Field>
              </div>
              <Field label="Lugar" required error={errors.place}>
                <Input
                  required
                  value={text('place')}
                  onChange={(e) => update('place', e.target.value)}
                  placeholder="Ej. Hospital Italiano"
                />
              </Field>
              <Field label="Qué llevar" required error={errors.bring}>
                <Textarea
                  required
                  value={text('bring')}
                  onChange={(e) => update('bring', e.target.value)}
                  placeholder="DNI, credencial, estudios..."
                />
              </Field>
              <Field label="Estado">
                <NativeSelect
                  className="w-full"
                  value={text('status')}
                  onChange={(e) => update('status', e.target.value)}
                >
                  <NativeSelectOption>Próximo</NativeSelectOption>
                  <NativeSelectOption>Realizado</NativeSelectOption>
                  <NativeSelectOption>Cancelado</NativeSelectOption>
                </NativeSelect>
              </Field>
            </>
          )}
          {entity === 'order' && (
            <>
              <Field label="Especialidad" required error={errors.specialty}>
                <Input
                  required
                  value={text('specialty')}
                  onChange={(e) => update('specialty', e.target.value)}
                  placeholder="Ej. Cardiología"
                />
              </Field>
              <Field label="Motivo de la orden" required error={errors.reason}>
                <Textarea
                  required
                  value={text('reason')}
                  onChange={(e) => update('reason', e.target.value)}
                  placeholder="Ej. Evaluación y control anual"
                />
              </Field>
              <Field
                label="Médico solicitante"
                required
                error={errors.requestedBy}
              >
                <Input
                  required
                  value={text('requestedBy')}
                  onChange={(e) => update('requestedBy', e.target.value)}
                  placeholder="Ej. Dra. Laura Pérez"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Fecha de emisión"
                  required
                  error={errors.issueDate}
                >
                  <Input
                    required
                    type="date"
                    value={text('issueDate')}
                    onChange={(e) => update('issueDate', e.target.value)}
                  />
                </Field>
                <Field
                  label="Fecha de vencimiento"
                  required
                  error={errors.expirationDate}
                >
                  <Input
                    required
                    type="date"
                    min={text('issueDate') || undefined}
                    value={text('expirationDate')}
                    onChange={(e) => update('expirationDate', e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}
          {entity === 'medication' && (
            <>
              <Field label="Nombre" required error={errors.name}>
                <Input
                  required
                  value={text('name')}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Ej. Losartán"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Dosis" required error={errors.dose}>
                  <Input
                    required
                    value={text('dose')}
                    onChange={(e) => update('dose', e.target.value)}
                    placeholder="Ej. 50 mg"
                  />
                </Field>
                <Field label="Frecuencia" required error={errors.frequency}>
                  <Input
                    required
                    value={text('frequency')}
                    onChange={(e) => update('frequency', e.target.value)}
                    placeholder="Ej. 1 por día"
                  />
                </Field>
              </div>
              <Field
                label="Médico que lo indicó"
                required
                error={errors.doctor}
              >
                <Input
                  required
                  value={text('doctor')}
                  onChange={(e) => update('doctor', e.target.value)}
                  placeholder="Ej. Dr. Gómez"
                />
              </Field>
              <div className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium">
                <span>Medicamento activo</span>
                <Switch
                  aria-label="Medicamento activo"
                  checked={Boolean(form.active)}
                  onCheckedChange={(checked) => update('active', checked)}
                />
              </div>
            </>
          )}
          {entity === 'prescription' && (
            <>
              <Field label="Medicamento" required error={errors.medicationName}>
                <Input
                  required
                  value={text('medicationName')}
                  onChange={(e) => update('medicationName', e.target.value)}
                  placeholder="Ej. Losartán"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Presentación"
                  required
                  error={errors.presentation}
                >
                  <Input
                    required
                    value={text('presentation')}
                    onChange={(e) => update('presentation', e.target.value)}
                    placeholder="Ej. Comprimidos de 50 mg"
                  />
                </Field>
                <Field label="Dosis" required error={errors.dose}>
                  <Input
                    required
                    value={text('dose')}
                    onChange={(e) => update('dose', e.target.value)}
                    placeholder="Ej. 50 mg"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Frecuencia" required error={errors.frequency}>
                  <Input
                    required
                    value={text('frequency')}
                    onChange={(e) => update('frequency', e.target.value)}
                    placeholder="Ej. Una vez por día"
                  />
                </Field>
                <Field label="Duración" required error={errors.duration}>
                  <Input
                    required
                    value={text('duration')}
                    onChange={(e) => update('duration', e.target.value)}
                    placeholder="Ej. 30 días"
                  />
                </Field>
              </div>
              <Field
                label="Médico prescriptor"
                required
                error={errors.prescribedBy}
              >
                <Input
                  required
                  value={text('prescribedBy')}
                  onChange={(e) => update('prescribedBy', e.target.value)}
                  placeholder="Ej. Dr. Gómez"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Fecha de emisión"
                  required
                  error={errors.issueDate}
                >
                  <Input
                    required
                    type="date"
                    value={text('issueDate')}
                    onChange={(e) => update('issueDate', e.target.value)}
                  />
                </Field>
                <Field
                  label="Fecha de vencimiento"
                  required
                  error={errors.expirationDate}
                >
                  <Input
                    required
                    type="date"
                    min={text('issueDate') || undefined}
                    value={text('expirationDate')}
                    onChange={(e) => update('expirationDate', e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}
          {entity === 'task' && (
            <>
              <Field label="Título" required error={errors.title}>
                <Input
                  required
                  value={text('title')}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="Ej. Pedir nueva receta"
                />
              </Field>
              <Field label="Fecha límite (opcional)">
                <Input
                  type="date"
                  value={text('dueDate')}
                  onChange={(e) => update('dueDate', e.target.value)}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Prioridad">
                  <NativeSelect
                    className="w-full"
                    value={text('priority')}
                    onChange={(e) => update('priority', e.target.value)}
                  >
                    <NativeSelectOption>Normal</NativeSelectOption>
                    <NativeSelectOption>Importante</NativeSelectOption>
                    <NativeSelectOption>Urgente</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field label="Estado">
                  <NativeSelect
                    className="w-full"
                    value={text('status')}
                    onChange={(e) => update('status', e.target.value)}
                  >
                    <NativeSelectOption>Pendiente</NativeSelectOption>
                    <NativeSelectOption>Completado</NativeSelectOption>
                  </NativeSelect>
                </Field>
              </div>
              {canShowToElder && (
                <div className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium">
                  <div>
                    <p>Mostrar a la persona</p>
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      Podrá ver este pendiente y recibir su alerta.
                    </p>
                  </div>
                  <Switch
                    aria-label="Mostrar pendiente a la persona"
                    checked={Boolean(form.visibleToElder)}
                    onCheckedChange={(checked) =>
                      update('visibleToElder', checked)
                    }
                  />
                </div>
              )}
            </>
          )}
          <Field label="Notas (opcional)">
            <Textarea
              value={text('notes')}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Agregá una aclaración útil"
            />
          </Field>
        </form>
        <DialogFooter className="-mx-5 -mb-5 mt-1 sm:-mx-6 sm:-mb-6">
          <Button
            variant="outline"
            type="button"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="submit" form="record-form" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
