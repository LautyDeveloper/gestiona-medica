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
        return Response.json({
          state: 'setup-required',
          setupRequired: true,
        });
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
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/session',
      expect.anything(),
    );
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

  it('no muestra un login engañoso si falla la comprobación inicial', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          error: 'No disponible',
          code: 'DATABASE_UNAVAILABLE',
        },
        { status: 503 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AuthShell>
        <p>Aplicación</p>
      </AuthShell>,
    );

    expect(
      await screen.findByText('No pudimos comprobar el acceso'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Iniciar sesión' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Reiniciá la aplicación para aplicar las migraciones/),
    ).toBeInTheDocument();
  });

  it('no muestra login cuando la configuración de cuentas es inconsistente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({ state: 'invalid', setupRequired: false }),
      ),
    );
    render(
      <AuthShell>
        <p>Aplicación</p>
      </AuthShell>,
    );

    expect(
      await screen.findByText(/La configuración de acceso está incompleta/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Iniciar sesión' }),
    ).not.toBeInTheDocument();
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
        return Response.json({ state: 'ready', setupRequired: false });
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

  it('muestra la pantalla de espera al iniciar sesión como abuelo', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          input instanceof Request
            ? input.url
            : input instanceof URL
              ? input.href
              : input;
        if (url === '/api/auth/bootstrap')
          return Response.json({ state: 'ready', setupRequired: false });
        if (url === '/api/session')
          return Response.json({ error: 'Iniciá sesión' }, { status: 401 });
        if (url === '/api/auth/login' && init?.method === 'POST')
          return Response.json({ ok: true, userType: 'elder' });
        return Response.json({ ok: true });
      },
    );
    vi.stubGlobal('fetch', fetchMock);
    render(
      <AuthShell>
        <p>Aplicación de cuidadores</p>
      </AuthShell>,
    );

    await userEvent.type(await screen.findByLabelText('Usuario'), 'maria');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'clave-segura');
    await userEvent.click(
      screen.getByRole('button', { name: 'Iniciar sesión' }),
    );

    expect(await screen.findByText('Tu acceso está listo')).toBeInTheDocument();
    expect(
      screen.queryByText('Aplicación de cuidadores'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument();
  });
});
