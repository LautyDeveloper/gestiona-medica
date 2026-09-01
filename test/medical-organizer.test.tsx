import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MedicalOrganizer } from '@/components/medical-organizer';
import type { AppData, PersonSummary } from '@/lib/models';

const anaId = '11111111-1111-4111-8111-111111111111';
const luisId = '22222222-2222-4222-8222-222222222222';
const appointmentId = '33333333-3333-4333-8333-333333333333';
const groupId = '44444444-4444-4444-8444-444444444444';
const group = {
  id: groupId,
  name: 'Familia Pérez',
  role: 'admin' as const,
  memberCount: 1,
  personCount: 2,
};
const people: PersonSummary[] = [
  {
    id: anaId,
    name: 'Ana Pérez',
    birthDate: '1980-01-10',
    relationship: 'Madre',
    notes: '',
    archived: false,
    appointmentCount: 1,
    orderCount: 0,
    medicationCount: 0,
    prescriptionCount: 0,
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
    orderCount: 0,
    medicationCount: 0,
    prescriptionCount: 0,
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
  orders: [],
  medications: [],
  prescriptions: [],
  tasks: [],
};
const luisData: AppData = {
  person: people[1],
  appointments: [],
  orders: [],
  medications: [],
  prescriptions: [],
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
    if (url === '/api/session')
      return Response.json({
        user: {
          id: 'u1',
          username: 'ana',
          displayName: 'Ana',
        },
        groups: [group],
      });
    if (url.startsWith('/api/groups?'))
      return Response.json({
        group,
        members: [],
        persons: people,
      });
    if (url.startsWith('/api/person?'))
      return Response.json({ persons: people });
    if (init?.method === 'DELETE') return Response.json({ ok: true });
    if (url.includes(encodeURIComponent(luisId)))
      return Response.json(luisData);
    return Response.json(anaData);
  });
}

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe('organizador multi-persona', () => {
  it('no consulta nuevamente los datos por un intervalo periódico', async () => {
    const fetchMock = mockApi();
    vi.stubGlobal('fetch', fetchMock);
    render(<MedicalOrganizer />);
    expect(await screen.findByText('Hola, Ana')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url =
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url;
          return url.startsWith('/api/groups?');
        }),
      ).toBe(true),
    );
    const callsAfterLoad = fetchMock.mock.calls.length;

    vi.useFakeTimers();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(fetchMock).toHaveBeenCalledTimes(callsAfterLoad);
  });

  it('restaura la última persona seleccionada sin mostrar datos ajenos', async () => {
    window.localStorage.setItem(`activePersonId:${groupId}`, luisId);
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

  it('abre Órdenes desde el menú Más en la navegación móvil', async () => {
    vi.stubGlobal('fetch', mockApi());
    render(<MedicalOrganizer />);
    expect(await screen.findByText('Hola, Ana')).toBeInTheDocument();

    const more = screen.getByRole('button', { name: 'Más' });
    more.focus();
    fireEvent.keyDown(more, { key: 'ArrowUp' });
    await userEvent.click(screen.getByRole('menuitem', { name: 'Órdenes' }));

    expect(
      screen.getByRole('heading', { name: 'Órdenes' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No hay órdenes pendientes')).toBeInTheDocument();
  });

  it('crea una persona desde Grupo familiar y la deja como perfil activo', async () => {
    const newPersonId = '55555555-5555-4555-8555-555555555555';
    let currentPeople = [...people];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          input instanceof Request
            ? input.url
            : input instanceof URL
              ? input.href
              : input;
        if (url === '/api/session')
          return Response.json({
            user: { id: 'u1', username: 'ana', displayName: 'Ana' },
            groups: [group],
          });
        if (url.startsWith('/api/groups?'))
          return Response.json({
            group: { ...group, personCount: currentPeople.length },
            members: [
              {
                id: 'u1',
                username: 'ana',
                displayName: 'Ana',
                role: 'admin',
              },
            ],
            persons: currentPeople,
          });
        if (url === '/api/person' && init?.method === 'POST') {
          currentPeople = [
            ...currentPeople,
            {
              id: newPersonId,
              name: 'María González',
              birthDate: '1940-05-12',
              relationship: 'Abuela',
              notes: '',
              archived: false,
              appointmentCount: 0,
              orderCount: 0,
              medicationCount: 0,
              prescriptionCount: 0,
              taskCount: 0,
            },
          ];
          return Response.json({ id: newPersonId }, { status: 201 });
        }
        if (url.startsWith('/api/person?'))
          return Response.json({ persons: currentPeople });
        if (url.includes(encodeURIComponent(newPersonId)))
          return Response.json({
            person: currentPeople.at(-1),
            appointments: [],
            orders: [],
            medications: [],
            prescriptions: [],
            tasks: [],
          });
        return Response.json(anaData);
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<MedicalOrganizer />);
    expect(await screen.findByText('Hola, Ana')).toBeInTheDocument();

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Grupo familiar' })[0],
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Agregar persona' }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: /Nombre completo/ }),
      'María González',
    );
    await userEvent.type(
      screen.getByLabelText(/Fecha de nacimiento/),
      '1940-05-12',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: /Tu vínculo/ }),
      'Abuela',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Crear perfil' }));

    await waitFor(() =>
      expect(
        screen.getByText(/Perfil activo: María González/),
      ).toBeInTheDocument(),
    );
    expect(
      fetchMock.mock.calls.some(
        ([input, init]) => input === '/api/person' && init?.method === 'POST',
      ),
    ).toBe(true);
  });
});
