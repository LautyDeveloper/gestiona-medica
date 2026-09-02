'use client';

import { useState } from 'react';
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
import type { Medication } from '@/lib/models';

export function MedicationRestockDialog({
  medication,
  onOpenChange,
  onSave,
}: {
  medication: Medication | null;
  onOpenChange: (open: boolean) => void;
  onSave: (quantity: number, mode: 'add' | 'set') => Promise<void>;
}) {
  const [quantity, setQuantity] = useState('');
  const [mode, setMode] = useState<'add' | 'set'>('add');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return (
    <Dialog open={Boolean(medication)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Actualizar cantidad estimada</DialogTitle>
          <DialogDescription>
            {medication?.name}. Este dato es orientativo y puede requerir
            correcciones manuales.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {error && (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <label className="grid gap-2 text-sm font-medium">
            Operación
            <select
              className="h-10 rounded-xl border bg-background px-3"
              value={mode}
              onChange={(event) => setMode(event.target.value as typeof mode)}
            >
              <option value="add">Agregar una reposición</option>
              <option value="set">Corregir el total disponible</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Cantidad en {medication?.stockUnit || 'unidades'}
            <Input
              type="number"
              min="0.001"
              step="0.001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saving || !quantity || Number(quantity) <= 0}
            onClick={async () => {
              setSaving(true);
              setError('');
              try {
                await onSave(Number(quantity), mode);
                setQuantity('');
                onOpenChange(false);
              } catch (caught) {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : 'No se pudo guardar la cantidad',
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? 'Guardando…' : 'Guardar cantidad'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
