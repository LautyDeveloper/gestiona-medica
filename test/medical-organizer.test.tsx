import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MedicalOrganizer } from '@/components/medical-organizer';
import type { AppData } from '@/lib/models';

const personId = '11111111-1111-4111-8111-111111111111';
const data: AppData = {
  person: {
    id: personId,
    name: 'Ana Pérez',
    birthDate: '1980-01-10',
    relationship: 'Madre',
    notes: '',
  },
  appointments: [
    {
      id: 'appointment-1',
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
  ],
  medications: [],
  tasks: [],
};

afterEach(() => vi.unstubAllGlobals());

describe('organizador', () => {
  it('no elimina hasta confirmar y luego recarga los datos', async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'DELETE') return Response.json({ ok: true });
        return Response.json(data);
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<MedicalOrganizer />);
    expect(await screen.findByText('Hola, Ana')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Turnos' })[0]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Eliminar turno de Cardiología' }),
    );
    expect(
      screen.getByText('¿Eliminar el turno de Cardiología?'),
    ).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE'),
    ).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE'),
      ).toBe(true),
    );
  });
});
