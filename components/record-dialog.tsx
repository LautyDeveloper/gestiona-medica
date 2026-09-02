'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
    scheduleType: 'unstructured',
    scheduleTimes: [],
    startDate: '',
    endDate: '',
    intervalMinutes: null,
    intervalAnchorAt: '',
    presentation: '',
    stockUnit: '',
    unitsPerIntake: null,
    stockQuantity: null,
    reorderThreshold: null,
    stockCycle: 1,
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
  const number = (key: string) =>
    typeof form[key] === 'number' ? (form[key] as number) : null;
  const scheduleTimes = Array.isArray(form.scheduleTimes)
    ? (form.scheduleTimes as string[])
    : [];

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
              <div className="rounded-2xl border bg-muted/20 p-4">
                <h3 className="font-semibold">Plan de tomas</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Confirmá los horarios manualmente. Cerca no interpreta la
                  frecuencia escrita ni recomienda una pauta.
                </p>
                <div className="mt-4 grid gap-4">
                  <Field label="Tipo de plan" error={errors.scheduleType}>
                    <NativeSelect
                      value={text('scheduleType')}
                      onChange={(event) => {
                        const next = event.target.value;
                        setForm((current) => ({
                          ...current,
                          scheduleType: next,
                          scheduleTimes:
                            next === 'fixed_times'
                              ? scheduleTimes.length
                                ? scheduleTimes
                                : ['08:00']
                              : [],
                          intervalMinutes:
                            next === 'interval'
                              ? number('intervalMinutes') || 480
                              : null,
                          intervalAnchorAt:
                            next === 'interval'
                              ? text('intervalAnchorAt') || `${today}T08:00`
                              : '',
                          startDate:
                            next === 'unstructured'
                              ? ''
                              : text('startDate') || today,
                        }));
                      }}
                    >
                      <NativeSelectOption value="unstructured">
                        Sin estructurar
                      </NativeSelectOption>
                      <NativeSelectOption value="fixed_times">
                        Horarios fijos
                      </NativeSelectOption>
                      <NativeSelectOption value="interval">
                        Cada determinada cantidad de horas
                      </NativeSelectOption>
                      <NativeSelectOption value="as_needed">
                        Según necesidad
                      </NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  {text('scheduleType') !== 'unstructured' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Fecha de inicio"
                        required
                        error={errors.startDate}
                      >
                        <Input
                          required
                          type="date"
                          value={text('startDate')}
                          onChange={(event) =>
                            update('startDate', event.target.value)
                          }
                        />
                      </Field>
                      <Field label="Fecha de fin" error={errors.endDate}>
                        <Input
                          type="date"
                          min={text('startDate') || undefined}
                          value={text('endDate')}
                          onChange={(event) =>
                            update('endDate', event.target.value)
                          }
                        />
                      </Field>
                    </div>
                  )}
                  {text('scheduleType') === 'fixed_times' && (
                    <div className="grid gap-2">
                      <span className="text-sm font-medium">
                        Horarios confirmados
                      </span>
                      {scheduleTimes.map((time, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            aria-label={`Horario ${index + 1}`}
                            type="time"
                            value={time}
                            onChange={(event) =>
                              update(
                                'scheduleTimes',
                                scheduleTimes.map((current, position) =>
                                  position === index
                                    ? event.target.value
                                    : current,
                                ),
                              )
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Eliminar horario ${index + 1}`}
                            onClick={() =>
                              update(
                                'scheduleTimes',
                                scheduleTimes.filter(
                                  (_, position) => position !== index,
                                ),
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))}
                      {errors.scheduleTimes && (
                        <span className="text-xs text-destructive">
                          {errors.scheduleTimes}
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        disabled={scheduleTimes.length >= 12}
                        onClick={() =>
                          update('scheduleTimes', [
                            ...scheduleTimes,
                            scheduleTimes.at(-1) || '08:00',
                          ])
                        }
                      >
                        <Plus /> Agregar horario
                      </Button>
                    </div>
                  )}
                  {text('scheduleType') === 'interval' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Cada cuántas horas"
                        required
                        error={errors.intervalMinutes}
                      >
                        <Input
                          required
                          type="number"
                          min="0.5"
                          max="168"
                          step="0.5"
                          value={
                            number('intervalMinutes') === null
                              ? ''
                              : number('intervalMinutes')! / 60
                          }
                          onChange={(event) =>
                            update(
                              'intervalMinutes',
                              event.target.value
                                ? Number(event.target.value) * 60
                                : null,
                            )
                          }
                        />
                      </Field>
                      <Field
                        label="Calcular desde"
                        required
                        error={errors.intervalAnchorAt}
                      >
                        <Input
                          required
                          type="datetime-local"
                          value={text('intervalAnchorAt')}
                          onChange={(event) =>
                            update('intervalAnchorAt', event.target.value)
                          }
                        />
                      </Field>
                    </div>
                  )}
                  {text('scheduleType') === 'as_needed' && (
                    <p className="rounded-xl bg-primary/8 p-3 text-sm text-muted-foreground">
                      No se crearán horarios esperados. Las tomas se registran
                      manualmente cuando ocurren.
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border bg-muted/20 p-4">
                <h3 className="font-semibold">Presentación y reposición</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  El stock es una estimación y nunca condiciona el registro de
                  una toma.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Presentación" error={errors.presentation}>
                    <Input
                      value={text('presentation')}
                      onChange={(event) =>
                        update('presentation', event.target.value)
                      }
                      placeholder="Ej. Caja de 30 comprimidos"
                    />
                  </Field>
                  <Field label="Unidad de stock" error={errors.stockUnit}>
                    <Input
                      value={text('stockUnit')}
                      onChange={(event) =>
                        update('stockUnit', event.target.value)
                      }
                      placeholder="Ej. comprimidos, ml o dosis"
                    />
                  </Field>
                  <Field
                    label="Cantidad por toma"
                    error={errors.unitsPerIntake}
                  >
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={number('unitsPerIntake') ?? ''}
                      onChange={(event) =>
                        update(
                          'unitsPerIntake',
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                    />
                  </Field>
                  <Field
                    label={value ? 'Cantidad estimada' : 'Cantidad inicial'}
                    error={errors.stockQuantity}
                  >
                    <Input
                      type="number"
                      step="0.001"
                      disabled={Boolean(value)}
                      value={number('stockQuantity') ?? ''}
                      onChange={(event) =>
                        update(
                          'stockQuantity',
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                    />
                  </Field>
                  <Field
                    label="Avisar cuando queden"
                    error={errors.reorderThreshold}
                  >
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={number('reorderThreshold') ?? ''}
                      onChange={(event) =>
                        update(
                          'reorderThreshold',
                          event.target.value
                            ? Number(event.target.value)
                            : null,
                        )
                      }
                    />
                  </Field>
                </div>
              </div>
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
