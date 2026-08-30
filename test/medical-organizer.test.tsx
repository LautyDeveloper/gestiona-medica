import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MedicalOrganizer } from '@/components/medical-organizer';
import type { AppData, PersonSummary } from '@/lib/models';

const anaId = '11111111-1111-4111-8111-111111111111';
const luisId = '22222222-2222-4222-8222-222222222222';
const appointmentId = '33333333-3333-4333-8333-333333333333';
const people: PersonSummary[] = [
  {
    id: anaId,
    name: 'Ana Pérez',
    birthDate: '1980-01-10',
    relationship: 'Madre',
    notes: '',
    archived: false,
    appointmentCount: 1,
    medicationCount: 0,
    taskCount: 0,
  },
  {
    id: luisId,
    name: 'Luis Pérez',
    birthDate: '1978-03-04',
    relationship: 'Padre',
    notes: '',
    archived: false,
    appointmentCount: 0,
    medicationCount: 0,
    taskCount: 0,
  },
];
const anaData: AppData = {
  person: people[0],
  appointments: [
    {
      id: appointmentId,
      personId: anaId,
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
const luisData: AppData = {
  person: people[1],
  appointments: [],
  medications: [],
  tasks: [],
};

function mockApi() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.href
          : input;
    if (url === '/api/person') return Response.json({ persons: people });
    if (init?.method === 'DELETE') return Response.json({ ok: true });
    if (url.includes(encodeURIComponent(luisId)))
      return Response.json(luisData);
    return Response.json(anaData);
  });
}

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('organizador multi-persona', () => {
  it('restaura la última persona seleccionada sin mostrar datos ajenos', async () => {
    window.localStorage.setItem('activePersonId', luisId);
    vi.stubGlobal('fetch', mockApi());
    render(<MedicalOrganizer />);
    expect(await screen.findByText('Hola, Luis')).toBeInTheDocument();
    expect(screen.queryByText('Cardiología')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Todavía no cargaste información de Luis Pérez/),
    ).toBeInTheDocument();
  });

  it('no elimina un registro hasta confirmar y envía su personId', async () => {
    const fetchMock = mockApi();
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
        fetchMock.mock.calls.some(([input, init]) => {
          const url =
            input instanceof Request
              ? input.url
              : input instanceof URL
                ? input.href
                : input;
          return (
            init?.method === 'DELETE' &&
            url.includes(`personId=${encodeURIComponent(anaId)}`)
          );
        }),
      ).toBe(true),
    );
  });
});
