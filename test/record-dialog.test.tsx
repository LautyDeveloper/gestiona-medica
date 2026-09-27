import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecordDialog } from '@/components/record-dialog';

const personId = '11111111-1111-4111-8111-111111111111';

describe('formularios de registros', () => {
  it('crea un turno válido', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordDialog
        entity="appointment"
        personId={personId}
        value={null}
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );
    await userEvent.type(screen.getByLabelText(/Especialidad/), 'Cardiología');
    await userEvent.type(screen.getByLabelText(/^Médico/), 'Dra. Pérez');
    await userEvent.type(screen.getByLabelText(/Fecha/), '2026-09-01');
    await userEvent.type(screen.getByLabelText(/Hora/), '2 pm');
    await userEvent.type(screen.getByLabelText(/Lugar/), 'Hospital');
    await userEvent.type(screen.getByLabelText(/Qué llevar/), 'DNI');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith(
      'appointment',
      expect.objectContaining({
        specialty: 'Cardiología',
        time: '14:00',
        personId,
      }),
      undefined,
    );
  });

  it('crea un medicamento válido', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordDialog
        entity="medication"
        personId={personId}
        value={null}
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );
    await userEvent.type(screen.getByLabelText(/Nombre/), 'Losartán');
    await userEvent.type(screen.getByLabelText(/Dosis/), '50 mg');
    await userEvent.type(screen.getByLabelText(/Frecuencia/), 'Diario');
    await userEvent.type(
      screen.getByLabelText(/Médico que lo indicó/),
      'Dra. Pérez',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith(
      'medication',
      expect.objectContaining({ name: 'Losartán', active: true, personId }),
      undefined,
    );
  });

  it('crea una orden médica con emisión y vencimiento', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordDialog
        entity="order"
        personId={personId}
        value={null}
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );
    await userEvent.type(screen.getByLabelText(/Especialidad/), 'Cardiología');
    await userEvent.type(
      screen.getByLabelText(/Motivo de la orden/),
      'Control',
    );
    await userEvent.type(
      screen.getByLabelText(/Médico solicitante/),
      'Dra. Pérez',
    );
    await userEvent.clear(screen.getByLabelText(/Fecha de emisión/));
    await userEvent.type(
      screen.getByLabelText(/Fecha de emisión/),
      '2026-08-01',
    );
    await userEvent.type(
      screen.getByLabelText(/Fecha de vencimiento/),
      '2026-09-01',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith(
      'order',
      expect.objectContaining({
        specialty: 'Cardiología',
        issueDate: '2026-08-01',
        expirationDate: '2026-09-01',
        personId,
      }),
      undefined,
    );
  });

  it('crea una receta con el detalle clínico completo', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordDialog
        entity="prescription"
        personId={personId}
        value={null}
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );
    await userEvent.type(
      screen.getByLabelText(/Nombre en la receta/),
      'Losartán',
    );
    await userEvent.type(
      screen.getByLabelText(/Presentación/),
      'Comprimidos de 50 mg',
    );
    await userEvent.type(screen.getByLabelText(/Dosis/), '50 mg');
    await userEvent.type(screen.getByLabelText(/Frecuencia/), 'Diario');
    await userEvent.type(screen.getByLabelText(/Duración/), '30 días');
    await userEvent.type(
      screen.getByLabelText(/Médico prescriptor/),
      'Dra. Pérez',
    );
    await userEvent.clear(screen.getByLabelText(/Fecha de emisión/));
    await userEvent.type(
      screen.getByLabelText(/Fecha de emisión/),
      '2026-08-01',
    );
    await userEvent.type(
      screen.getByLabelText(/Fecha de vencimiento/),
      '2026-09-01',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith(
      'prescription',
      expect.objectContaining({
        medicationName: 'Losartán',
        presentation: 'Comprimidos de 50 mg',
        duration: '30 días',
        personId,
      }),
      undefined,
    );
  });

  it('precarga una receta desde un medicamento sin modificar el tratamiento', async () => {
    const medication = {
      id: '22222222-2222-4222-8222-222222222222',
      personId,
      name: 'Simultan',
      dose: '10 mg',
      frequency: 'Una vez por día',
      doctor: 'Dra. Pérez',
      notes: '',
      active: true,
      scheduleType: 'unstructured' as const,
      scheduleTimes: [],
      startDate: '',
      endDate: '',
      intervalMinutes: null,
      intervalAnchorAt: '',
      presentation: 'Caja de 30 comprimidos',
      stockUnit: 'comprimidos',
      unitsPerIntake: 1,
      stockQuantity: 20,
      reorderThreshold: 5,
    };
    render(
      <RecordDialog
        entity="prescription"
        personId={personId}
        value={null}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        medications={[medication]}
      />,
    );

    await userEvent.selectOptions(
      screen.getByLabelText(/Medicamento asociado/),
      medication.id,
    );
    expect(screen.getByLabelText(/Nombre en la receta/)).toHaveValue(
      'Simultan',
    );
    expect(screen.getByLabelText(/Presentación/)).toHaveValue(
      'Caja de 30 comprimidos',
    );
    expect(screen.getByLabelText(/Dosis/)).toHaveValue('10 mg');
    await userEvent.clear(screen.getByLabelText(/Dosis/));
    await userEvent.type(screen.getByLabelText(/Dosis/), '20 mg');
    expect(medication.dose).toBe('10 mg');
  });

  it('crea un pendiente válido', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <RecordDialog
        entity="task"
        personId={personId}
        value={null}
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
      />,
    );
    await userEvent.type(screen.getByLabelText(/Título/), 'Pedir receta');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith(
      'task',
      expect.objectContaining({ title: 'Pedir receta', personId }),
      undefined,
    );
  });
});
