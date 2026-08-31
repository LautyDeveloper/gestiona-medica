import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElderApp } from '@/components/elder-app';

beforeEach(() => vi.setSystemTime(new Date('2026-08-31T15:00:00Z')));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const data = {
  person: { id: 'p1', name: 'María González' },
  appointments: [
    {
      id: 'a1',
      personId: 'p1',
      specialty: 'Cardiología',
      doctor: 'Dra. Pérez',
      date: '2026-09-02',
      time: '10:30',
      place: 'Hospital Central',
      bring: 'DNI y estudios',
      notes: '',
      status: 'Próximo' as const,
    },
    {
      id: 'a2',
      personId: 'p1',
      specialty: 'Clínica anterior',
      doctor: 'Dr. Gómez',
      date: '2026-08-01',
      time: '09:00',
      place: 'Consultorio',
      bring: 'DNI',
      notes: '',
      status: 'Realizado' as const,
    },
  ],
  medications: [
    {
      id: 'm1',
      personId: 'p1',
      name: 'Losartán',
      dose: '50 mg',
      frequency: 'Una vez por día',
      doctor: 'Dra. Pérez',
      notes: 'Con agua',
      active: true,
    },
    {
      id: 'm2',
      personId: 'p1',
      name: 'Tratamiento anterior',
      dose: '10 mg',
      frequency: 'Por la noche',
      doctor: 'Dr. Gómez',
      notes: '',
      active: false,
    },
  ],
};

describe('vista del abuelo', () => {
  it('muestra en inicio el próximo turno y todos los tratamientos activos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(data)),
    );
    render(<ElderApp onLogout={vi.fn()} />);

    expect(await screen.findByText('Hola, María')).toBeInTheDocument();
    expect(screen.getByText('Cardiología')).toBeInTheDocument();
    expect(screen.getByText('DNI y estudios')).toBeInTheDocument();
    expect(screen.getByText('Losartán')).toBeInTheDocument();
    expect(screen.getByText('50 mg')).toBeInTheDocument();
    expect(screen.getByText('Una vez por día')).toBeInTheDocument();
    expect(screen.queryByText('Tratamiento anterior')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Editar|Eliminar|Crear/ }),
    ).not.toBeInTheDocument();
  });

  it('permite explorar turnos anteriores y medicamentos inactivos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(data)),
    );
    render(<ElderApp onLogout={vi.fn()} />);
    await screen.findByText('Hola, María');

    await userEvent.click(screen.getByRole('button', { name: 'Turnos' }));
    expect(screen.getByText('Cardiología')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Anteriores (1)' }),
    );
    expect(screen.getByText('Clínica anterior')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Medicamentos' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Anteriores (1)' }),
    );
    expect(screen.getByText('Tratamiento anterior')).toBeInTheDocument();
  });

  it('ofrece reintentar cuando falla la carga', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: 'Sin conexión' }, { status: 503 }),
      )
      .mockResolvedValueOnce(Response.json(data));
    vi.stubGlobal('fetch', fetchMock);
    render(<ElderApp onLogout={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Sin conexión');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() =>
      expect(screen.getByText('Hola, María')).toBeInTheDocument(),
    );
  });
});
