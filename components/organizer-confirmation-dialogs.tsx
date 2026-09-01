'use client';

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
import type { PersonSummary } from '@/lib/models';

export function ArchiveDialog({
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

export function RestoreDialog({
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
