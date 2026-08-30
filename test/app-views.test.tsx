import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  AppointmentsView,
  MedicationsView,
  TasksView,
} from '@/components/app-views';

const noop = vi.fn();
const personId = '11111111-1111-4111-8111-111111111111';

describe('filtros de listas', () => {
  it('abre turnos próximos y permite ver realizados', async () => {
    render(
      <AppointmentsView
        items={[
          {
            id: '1',
            personId,
            specialty: 'Cardiología',
            doctor: 'Dra. A',
            date: '2026-09-01',
            time: '10:00',
            place: 'Hospital',
            bring: 'DNI',
            notes: '',
            status: 'Próximo',
          },
          {
            id: '2',
            personId,
            specialty: 'Clínica',
            doctor: 'Dr. B',
            date: '2026-08-01',
            time: '09:00',
            place: 'Centro',
            bring: 'Estudios',
            notes: '',
            status: 'Realizado',
          },
        ]}
        onNew={noop}
        onEdit={noop}
        onComplete={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('Cardiología')).toBeInTheDocument();
    expect(screen.queryByText('Clínica')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Realizados/ }));
    expect(screen.getByText('Clínica')).toBeInTheDocument();
  });

  it('abre medicamentos activos y permite ver inactivos', async () => {
    render(
      <MedicationsView
        items={[
          {
            id: '1',
            personId,
            name: 'Activo Uno',
            dose: '1 mg',
            frequency: 'Diario',
            doctor: 'Dra. A',
            notes: '',
            active: true,
          },
          {
            id: '2',
            personId,
            name: 'Inactivo Uno',
            dose: '2 mg',
            frequency: 'Diario',
            doctor: 'Dra. A',
            notes: '',
            active: false,
          },
        ]}
        onNew={noop}
        onEdit={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('Activo Uno')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Inactivos/ }));
    expect(screen.getByText('Inactivo Uno')).toBeInTheDocument();
  });

  it('abre pendientes y ejecuta el cambio de estado', async () => {
    const onComplete = vi.fn();
    const task = {
      id: '1',
      personId,
      title: 'Pedir receta',
      dueDate: '',
      priority: 'Normal' as const,
      status: 'Pendiente' as const,
      notes: '',
    };
    render(
      <TasksView
        items={[task]}
        onNew={noop}
        onEdit={noop}
        onComplete={onComplete}
        onDelete={noop}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Marcar como completado' }),
    );
    expect(onComplete).toHaveBeenCalledWith(task);
  });

  it('ofrece crear desde un estado vacío accionable', async () => {
    const onNew = vi.fn();
    render(
      <TasksView
        items={[]}
        onNew={onNew}
        onEdit={noop}
        onComplete={noop}
        onDelete={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Crear ahora' }));
    expect(onNew).toHaveBeenCalledOnce();
  });
});
