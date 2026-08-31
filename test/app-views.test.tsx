import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  AppointmentsView,
  MedicationsView,
  OrdersView,
  PrescriptionsView,
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

  it('separa órdenes pendientes, utilizadas y vencidas', async () => {
    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
    const pending = {
      id: 'o1',
      personId,
      specialty: 'Cardiología',
      reason: 'Control',
      requestedBy: 'Dra. A',
      issueDate: '2026-08-01',
      expirationDate: '2026-09-10',
      notes: '',
      status: 'pending' as const,
      appointmentId: null,
      usedAt: null,
    };
    render(
      <OrdersView
        items={[
          pending,
          {
            ...pending,
            id: 'o2',
            specialty: 'Clínica',
            expirationDate: '2026-08-01',
          },
          {
            ...pending,
            id: 'o3',
            specialty: 'Neurología',
            status: 'used',
          },
        ]}
        onNew={noop}
        onEdit={noop}
        onConvert={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('Cardiología')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Sacar turno/ }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Vencidas/ }));
    expect(screen.getByText('Clínica')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Sacar turno/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Utilizadas/ }));
    expect(screen.getByText('Neurología')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('permite convertir una receta pendiente en medicamento', async () => {
    vi.setSystemTime(new Date('2026-08-31T12:00:00Z'));
    const prescription = {
      id: 'r1',
      personId,
      medicationName: 'Losartán',
      presentation: 'Comprimidos de 50 mg',
      dose: '50 mg',
      frequency: 'Una vez por día',
      duration: '30 días',
      prescribedBy: 'Dra. A',
      issueDate: '2026-08-01',
      expirationDate: '2026-09-10',
      notes: '',
      status: 'pending' as const,
      medicationId: null,
      usedAt: null,
    };
    const onConvert = vi.fn();
    render(
      <PrescriptionsView
        items={[prescription]}
        onNew={noop}
        onEdit={noop}
        onConvert={onConvert}
        onDelete={noop}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Agregar a medicamentos/ }),
    );
    expect(onConvert).toHaveBeenCalledWith(prescription);
    vi.useRealTimers();
  });
});
