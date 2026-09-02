'use client';

import { Check, Clock3, History, Pill, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  MedicationIntakeStatus,
  MedicationOccurrence,
  MedicationTodayData,
} from '@/lib/models';

const formatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: 'America/Argentina/Buenos_Aires',
  hour: '2-digit',
  minute: '2-digit',
});

function statusLabel(occurrence: MedicationOccurrence) {
  if (occurrence.status === 'taken') return 'Registrada';
  if (occurrence.status === 'not_taken') return 'No se tomó';
  if (occurrence.status === 'unrecorded') return 'Sin registrar';
  if (occurrence.status === 'as_needed') return 'Según necesidad';
  return 'Próxima';
}

export function MedicationTodayPanel({
  data,
  loading = false,
  error = '',
  onRecord,
  onVoid,
}: {
  data: MedicationTodayData | null;
  loading?: boolean;
  error?: string;
  onRecord: (
    occurrence: MedicationOccurrence,
    status: MedicationIntakeStatus,
  ) => Promise<void>;
  onVoid: (intakeId: string) => Promise<void>;
}) {
  const occurrences = Array.isArray(data?.occurrences) ? data.occurrences : [];
  const recentIntakes = Array.isArray(data?.recentIntakes)
    ? data.recentIntakes
    : [];
  return (
    <section className="app-surface rounded-3xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-medication/12 text-medication">
          <Clock3 />
        </span>
        <div>
          <h2 className="text-xl font-semibold">Tomas de hoy</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Los estados son informados por la familia. “Sin registrar” no
            significa que una toma no haya ocurrido.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {occurrences.map((occurrence) => (
          <article
            key={occurrence.id}
            className="rounded-2xl border bg-background/70 p-4"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{occurrence.medicationName}</p>
                  <Badge variant="outline">{statusLabel(occurrence)}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {occurrence.dose}
                  {occurrence.scheduledFor
                    ? ` · ${formatter.format(new Date(occurrence.scheduledFor))}`
                    : ''}
                </p>
              </div>
              {!occurrence.intake && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void onRecord(occurrence, 'taken')}
                  >
                    <Check /> Registrar toma
                  </Button>
                  {occurrence.status !== 'as_needed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void onRecord(occurrence, 'not_taken')}
                    >
                      <X /> Registrar que no se tomó
                    </Button>
                  )}
                </div>
              )}
              {occurrence.intake && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void onVoid(occurrence.intake!.id)}
                >
                  Corregir registro
                </Button>
              )}
            </div>
          </article>
        ))}
        {!loading && !occurrences.length && (
          <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground">
            <Pill className="mx-auto mb-2 size-6" />
            No hay planes de tomas estructurados para hoy.
          </div>
        )}
        {loading && (
          <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground">
            Cargando tomas…
          </div>
        )}
      </div>
      {!!recentIntakes.length && (
        <details className="mt-5 rounded-2xl border p-4">
          <summary className="flex cursor-pointer items-center gap-2 font-medium">
            <History className="size-4" /> Historial reciente
          </summary>
          <div className="mt-3 space-y-2 text-sm">
            {recentIntakes.slice(0, 12).map((intake) => (
              <p
                key={intake.id}
                className={
                  intake.voidedAt ? 'text-muted-foreground line-through' : ''
                }
              >
                {formatter.format(new Date(intake.reportedAt))} ·{' '}
                {intake.status === 'taken' ? 'Toma registrada' : 'No se tomó'} ·{' '}
                {intake.recordedByName}
                {intake.voidedAt ? ' · corregida' : ''}
              </p>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
