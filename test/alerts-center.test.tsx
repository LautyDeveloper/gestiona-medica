import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AlertsView } from '@/components/alerts-center';
import type { Alert } from '@/lib/models';

const active: Alert = {
  id: 'task:t1:2026-09-01',
  kind: 'task',
  entityId: 't1',
  personId: 'p1',
  personName: 'María',
  title: 'Pedir receta',
  detail: 'Fecha límite: 2026-09-01',
  relevantAt: '2026-09-01',
  targetSection: 'tasks',
  state: 'active',
  urgency: 'today',
  readAt: null,
  snoozedUntil: null,
};

describe('centro de alertas', () => {
  it('filtra estados, ejecuta acciones y guarda preferencias', async () => {
    const onAction = vi.fn().mockResolvedValue(undefined);
    const onSavePreferences = vi.fn().mockResolvedValue(undefined);
    render(
      <AlertsView
        data={{
          unreadCount: 1,
          alerts: [
            active,
            {
              ...active,
              id: 'order:o1:2026-08-31',
              entityId: 'o1',
              kind: 'order',
              title: 'Orden de Clínica',
              targetSection: 'orders',
              state: 'read',
              urgency: 'overdue',
              readAt: '2026-09-01T12:00:00.000Z',
            },
          ],
        }}
        preferences={{
          appointmentLeadMinutes: 1440,
          taskLeadDays: 0,
          documentLeadDays: 7,
        }}
        onAction={onAction}
        onNavigate={vi.fn()}
        onSavePreferences={onSavePreferences}
      />,
    );
    expect(screen.getByText('Pedir receta')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Marcar leída' }));
    expect(onAction).toHaveBeenCalledWith({
      action: 'read',
      alertId: active.id,
    });
    await userEvent.click(screen.getByRole('button', { name: /Leídas \(1\)/ }));
    expect(screen.getByText('Orden de Clínica')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Turnos'), '2880');
    await userEvent.click(
      screen.getByRole('button', { name: 'Guardar preferencias' }),
    );
    expect(onSavePreferences).toHaveBeenCalledWith({
      appointmentLeadMinutes: 2880,
      taskLeadDays: 0,
      documentLeadDays: 7,
    });
  });
});
