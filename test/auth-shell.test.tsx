import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthShell } from '@/components/auth-shell';

afterEach(() => vi.unstubAllGlobals());

describe('acceso familiar simple', () => {
  it('muestra el setup inicial y crea al primer cuidador', async () => {
    const password = `test-${crypto.randomUUID()}`;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.href
            : input;
      if (url === '/api/auth/bootstrap')
        return Response.json({ setupRequired: true });
      if (url === '/api/session')
        return Response.json({ error: 'Iniciá sesión' }, { status: 401 });
      return Response.json({ ok: true }, { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AuthShell>
        <p>Aplicación</p>
      </AuthShell>,
    );
    expect(
      await screen.findByText('Configurá el primer cuidador'),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Tu nombre'), 'Lautaro');
    await userEvent.type(screen.getByLabelText('Usuario'), 'lautaro');
    await userEvent.type(screen.getByLabelText('Contraseña'), password);
    await userEvent.click(
      screen.getByRole('button', { name: 'Crear acceso inicial' }),
    );
    expect(await screen.findByText('Aplicación')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/bootstrap',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('muestra login cuando el setup ya está cerrado', async () => {
    const password = `test-${crypto.randomUUID()}`;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.href
            : input;
      if (url === '/api/auth/bootstrap')
        return Response.json({ setupRequired: false });
      if (url === '/api/session')
        return Response.json({ error: 'Iniciá sesión' }, { status: 401 });
      return Response.json({ ok: true });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AuthShell>
        <p>Aplicación</p>
      </AuthShell>,
    );
    expect(await screen.findByText('Bienvenido de nuevo')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Usuario'), 'yael');
    await userEvent.type(screen.getByLabelText('Contraseña'), password);
    await userEvent.click(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    );
    expect(await screen.findByText('Aplicación')).toBeInTheDocument();
  });
});
