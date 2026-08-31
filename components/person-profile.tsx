'use client';

import { useRef, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Download,
  HeartHandshake,
  Pencil,
  Plus,
  Upload,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/client-api';
import type { Person, PersonSummary } from '@/lib/models';
import { personSchema } from '@/lib/validation';

export type PersonPayload = Pick<
  Person,
  'name' | 'birthDate' | 'relationship' | 'notes'
>;

function PersonForm({
  id,
  value,
  submitLabel,
  onSave,
}: {
  id: string;
  value?: Person;
  submitLabel: string;
  onSave: (data: PersonPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<PersonPayload>(() =>
    value
      ? {
          name: value.name,
          birthDate: value.birthDate,
          relationship: value.relationship,
          notes: value.notes,
        }
      : { name: '', birthDate: '', relationship: '', notes: '' },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  function update(key: keyof PersonPayload, next: string) {
    setForm((current) => ({ ...current, [key]: next }));
    setErrors((current) => ({ ...current, [key]: '' }));
  }

  async function submit(event: React.SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setFormError('');
    const parsed = personSchema.safeParse(form);
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
      await onSave(parsed.data);
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
        error instanceof Error ? error.message : 'No se pudo guardar el perfil',
      );
    } finally {
      setSaving(false);
    }
  }

  const field = (
    key: keyof PersonPayload,
    label: string,
    control: React.ReactNode,
    required = false,
  ) => (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {required && (
        <span className="text-destructive" aria-hidden="true">
          {' '}
          *
        </span>
      )}
      {control}
      {errors[key] && (
        <span className="text-xs font-normal text-destructive">
          {errors[key]}
        </span>
      )}
    </label>
  );

  return (
    <form id={id} onSubmit={submit} className="grid gap-4">
      {formError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {formError}
        </p>
      )}
      {field(
        'name',
        'Nombre completo',
        <Input
          required
          value={form.name}
          onChange={(event) => update('name', event.target.value)}
          placeholder="Ej. María González"
        />,
        true,
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {field(
          'birthDate',
          'Fecha de nacimiento',
          <Input
            required
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={form.birthDate}
            onChange={(event) => update('birthDate', event.target.value)}
          />,
          true,
        )}
        {field(
          'relationship',
          'Tu vínculo',
          <Input
            required
            value={form.relationship}
            onChange={(event) => update('relationship', event.target.value)}
            placeholder="Ej. Abuela, pareja"
          />,
          true,
        )}
      </div>
      {field(
        'notes',
        'Notas (opcional)',
        <Textarea
          value={form.notes}
          onChange={(event) => update('notes', event.target.value)}
          placeholder="Información general que quieras tener presente"
        />,
      )}
      <Button className="mt-1" type="submit" form={id} disabled={saving}>
        {saving ? 'Guardando…' : submitLabel}
      </Button>
    </form>
  );
}

export function Onboarding({
  onSave,
}: {
  onSave: (data: PersonPayload) => Promise<void>;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 py-10 text-foreground">
      <section className="w-full max-w-xl rounded-3xl border bg-card p-6 shadow-[0_24px_80px_-48px_rgba(23,72,54,.65)] sm:p-9">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <HeartHandshake className="size-7" />
        </div>
        <p className="mt-7 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Bienvenido a Cerca
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
          ¿A quién vas a acompañar?
        </h1>
        <p className="mt-3 mb-7 text-sm leading-6 text-muted-foreground">
          Creá el primer perfil. Después vas a poder sumar a otras personas sin
          mezclar su información.
        </p>
        <PersonForm
          id="onboarding-form"
          submitLabel="Empezar a organizar"
          onSave={onSave}
        />
      </section>
    </main>
  );
}

export function NoActivePeople({
  onAdd,
  onManage,
}: {
  onAdd: () => void;
  onManage: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
      <section className="max-w-md rounded-3xl border bg-card p-8 text-center">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
          <Users />
        </div>
        <h1 className="mt-4 text-xl font-semibold">No hay perfiles activos</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Podés crear una persona nueva o restaurar uno de los perfiles
          archivados.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={onAdd}>
            <Plus />
            Agregar persona
          </Button>
          <Button variant="outline" onClick={onManage}>
            Ver archivados
          </Button>
        </div>
      </section>
    </main>
  );
}

export function PersonDialog({
  person,
  open,
  onOpenChange,
  onSave,
}: {
  person: Person | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: PersonPayload) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {person ? `Editar a ${person.name}` : 'Agregar persona'}
          </DialogTitle>
          <DialogDescription>
            {person
              ? 'Actualizá sus datos básicos.'
              : 'Creá un perfil independiente para organizar su salud.'}
          </DialogDescription>
        </DialogHeader>
        <PersonForm
          id="person-form"
          value={person || undefined}
          submitLabel={person ? 'Guardar cambios' : 'Crear perfil'}
          onSave={onSave}
        />
        <DialogFooter className="-mx-5 -mb-5 mt-1 sm:-mx-6 sm:-mb-6">
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function countLabel(person: PersonSummary) {
  const total =
    person.appointmentCount +
    person.orderCount +
    person.medicationCount +
    person.prescriptionCount +
    person.taskCount;
  return total === 0
    ? 'Sin información cargada'
    : `${total} ${total === 1 ? 'registro' : 'registros'}`;
}

export function PeopleManagerDialog({
  people,
  open,
  onOpenChange,
  onAdd,
  onEdit,
  onArchive,
  onRestore,
  onExport,
  onImport,
}: {
  people: PersonSummary[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: () => void;
  onEdit: (person: PersonSummary) => void;
  onArchive: (person: PersonSummary) => void;
  onRestore: (person: PersonSummary) => void;
  onExport: () => Promise<void>;
  onImport: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const active = people.filter((person) => !person.archived);
  const archived = people.filter((person) => person.archived);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-5 sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">Administrar personas</DialogTitle>
          <DialogDescription>
            Creá perfiles separados, archivá los que ya no usás y administrá el
            respaldo completo.
          </DialogDescription>
        </DialogHeader>
        <Button className="w-fit" onClick={onAdd}>
          <Plus />
          Agregar persona
        </Button>
        <section>
          <h3 className="mb-2 text-sm font-semibold">Perfiles activos</h3>
          <div className="space-y-2">
            {active.map((person) => (
              <article
                key={person.id}
                className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{person.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {person.relationship} · {countLabel(person)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(person)}
                  >
                    <Pencil />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onArchive(person)}
                  >
                    <Archive />
                    Archivar
                  </Button>
                </div>
              </article>
            ))}
            {active.length === 0 && (
              <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                No hay perfiles activos.
              </p>
            )}
          </div>
        </section>
        {archived.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Archivados</h3>
            <div className="space-y-2">
              {archived.map((person) => (
                <article
                  key={person.id}
                  className="flex flex-col gap-3 rounded-2xl border bg-muted/30 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{person.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {countLabel(person)} · Información conservada
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRestore(person)}
                  >
                    <ArchiveRestore />
                    Restaurar
                  </Button>
                </article>
              ))}
            </div>
          </section>
        )}
        <section className="rounded-2xl border bg-muted/35 p-4">
          <h3 className="text-sm font-semibold">Respaldo completo</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Incluye todas las personas, también las archivadas, y toda su
            información.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => void onExport()}
            >
              <Download />
              Descargar respaldo
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              <Upload />
              Restaurar respaldo
            </Button>
          </div>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.target.value = '';
            }}
          />
        </section>
        <DialogFooter className="-mx-5 -mb-5 mt-1 sm:-mx-6 sm:-mb-6">
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
