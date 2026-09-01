'use client';

import { useState } from 'react';
import {
  ArrowRight,
  ClipboardPlus,
  FileText,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  EmptyState,
  FilterBar,
  StatusBadge,
} from '@/components/view-primitives';
import type { MedicalOrder, Prescription } from '@/lib/models';
import { formatDate } from '@/lib/format';

type DocumentFilter = 'pending' | 'used' | 'expired';
type DatedDocument = {
  status: 'pending' | 'used';
  expirationDate: string;
};

function todayInArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function documentState(item: DatedDocument): DocumentFilter {
  if (item.status === 'used') return 'used';
  return item.expirationDate < todayInArgentina() ? 'expired' : 'pending';
}

function expiryDetails(item: DatedDocument) {
  if (item.status === 'used')
    return { label: 'Utilizada', tone: 'green' as const };
  const today = Date.parse(`${todayInArgentina()}T00:00:00Z`);
  const expiration = Date.parse(`${item.expirationDate}T00:00:00Z`);
  const days = Math.round((expiration - today) / 86_400_000);
  if (days < 0)
    return {
      label: `Venció hace ${Math.abs(days)} ${Math.abs(days) === 1 ? 'día' : 'días'}`,
      tone: 'red' as const,
    };
  if (days === 0) return { label: 'Vence hoy', tone: 'amber' as const };
  return {
    label: `Vence en ${days} ${days === 1 ? 'día' : 'días'}`,
    tone: days <= 7 ? ('amber' as const) : ('neutral' as const),
  };
}

function DocumentFilters({
  items,
  active,
  onChange,
}: {
  items: DatedDocument[];
  active: DocumentFilter;
  onChange: (value: DocumentFilter) => void;
}) {
  const labels: Record<DocumentFilter, string> = {
    pending: 'Pendientes',
    used: 'Utilizadas',
    expired: 'Vencidas',
  };
  return (
    <FilterBar
      values={(Object.keys(labels) as DocumentFilter[]).map((value) => ({
        value,
        label: labels[value],
        count: items.filter((item) => documentState(item) === value).length,
      }))}
      active={active}
      onChange={(value) => onChange(value as DocumentFilter)}
    />
  );
}

export function OrdersView({
  items,
  onNew,
  onEdit,
  onConvert,
  onDelete,
}: {
  items: MedicalOrder[];
  onNew: () => void;
  onEdit: (item: MedicalOrder) => void;
  onConvert: (item: MedicalOrder) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<DocumentFilter>('pending');
  const visible = items.filter((item) => documentState(item) === filter);
  return (
    <div className="page-rise space-y-4">
      <DocumentFilters items={items} active={filter} onChange={setFilter} />
      {visible.length === 0 && (
        <EmptyState
          icon={<ClipboardPlus />}
          title={`No hay órdenes ${filter === 'pending' ? 'pendientes' : filter === 'used' ? 'utilizadas' : 'vencidas'}`}
          text={
            filter === 'pending'
              ? 'Cargá una orden para controlar su vencimiento y luego sacar el turno.'
              : 'Las órdenes con este estado aparecerán acá.'
          }
          action={filter === 'pending' ? onNew : undefined}
        />
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((item) => {
          const expiry = expiryDetails(item);
          return (
            <article
              key={item.id}
              className="app-surface interactive-surface rounded-2xl border-t-4 border-t-order p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-order/12 text-order ring-1 ring-order/15">
                  <ClipboardPlus className="size-5" />
                </div>
                <StatusBadge tone={expiry.tone}>{expiry.label}</StatusBadge>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{item.specialty}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Solicitada por {item.requestedBy}
              </p>
              <p className="mt-3 text-sm leading-6">{item.reason}</p>
              <div className="mt-4 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <span>Emitida: {formatDate(item.issueDate)}</span>
                <span>Vence: {formatDate(item.expirationDate)}</span>
              </div>
              {item.notes && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {item.notes}
                </p>
              )}
              <div className="mt-5 flex flex-wrap justify-end gap-1">
                {documentState(item) === 'pending' && (
                  <Button variant="secondary" onClick={() => onConvert(item)}>
                    Sacar turno <ArrowRight />
                  </Button>
                )}
                <Button variant="ghost" onClick={() => onEdit(item)}>
                  <Pencil /> Editar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar orden de ${item.specialty}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function PrescriptionsView({
  items,
  onNew,
  onEdit,
  onConvert,
  onDelete,
}: {
  items: Prescription[];
  onNew: () => void;
  onEdit: (item: Prescription) => void;
  onConvert: (item: Prescription) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<DocumentFilter>('pending');
  const visible = items.filter((item) => documentState(item) === filter);
  return (
    <div className="page-rise space-y-4">
      <DocumentFilters items={items} active={filter} onChange={setFilter} />
      {visible.length === 0 && (
        <EmptyState
          icon={<FileText />}
          title={`No hay recetas ${filter === 'pending' ? 'pendientes' : filter === 'used' ? 'utilizadas' : 'vencidas'}`}
          text={
            filter === 'pending'
              ? 'Cargá una receta para guardar la indicación y controlar su vencimiento.'
              : 'Las recetas con este estado aparecerán acá.'
          }
          action={filter === 'pending' ? onNew : undefined}
        />
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((item) => {
          const expiry = expiryDetails(item);
          return (
            <article
              key={item.id}
              className="app-surface interactive-surface rounded-2xl border-t-4 border-t-prescription p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid size-11 place-items-center rounded-xl bg-prescription/12 text-prescription ring-1 ring-prescription/15">
                  <FileText className="size-5" />
                </div>
                <StatusBadge tone={expiry.tone}>{expiry.label}</StatusBadge>
              </div>
              <h3 className="mt-4 text-lg font-semibold">
                {item.medicationName}
              </h3>
              <p className="mt-1 text-sm font-semibold text-prescription">
                {item.presentation} · {item.dose}
              </p>
              <p className="mt-3 text-sm">
                {item.frequency} · {item.duration}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Indicada por {item.prescribedBy}
              </p>
              <div className="mt-4 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <span>Emitida: {formatDate(item.issueDate)}</span>
                <span>Vence: {formatDate(item.expirationDate)}</span>
              </div>
              {item.notes && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {item.notes}
                </p>
              )}
              <div className="mt-5 flex flex-wrap justify-end gap-1">
                {documentState(item) === 'pending' && (
                  <Button variant="secondary" onClick={() => onConvert(item)}>
                    Agregar a medicamentos <ArrowRight />
                  </Button>
                )}
                <Button variant="ghost" onClick={() => onEdit(item)}>
                  <Pencil /> Editar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Eliminar receta de ${item.medicationName}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 />
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
