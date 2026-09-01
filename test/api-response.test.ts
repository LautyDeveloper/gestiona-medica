// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
  handleApiError,
  HttpError,
  jsonError,
  readJson,
} from '@/lib/api-response';

describe('contrato común de la API', () => {
  it('convierte JSON malformado en un error 400 uniforme', async () => {
    const request = new Request('https://cerca.example/api/data', {
      method: 'POST',
      body: '{invalid',
    });

    const error = await readJson(request).catch((caught) => caught);
    const response = handleApiError(error, 'Error inesperado');

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'El cuerpo de la solicitud no contiene JSON válido',
    });
  });

  it('preserva estado y detalles de errores HTTP esperables', async () => {
    const response = handleApiError(
      new HttpError('Conflicto de versión', 409, { version: ['Obsoleta'] }),
      'Error inesperado',
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Conflicto de versión',
      details: { version: ['Obsoleta'] },
    });
  });

  it('oculta errores internos y conserva el formato JSON', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = handleApiError(new Error('database unavailable'), 'Falló');

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'Falló' });
    expect(jsonError('No existe', 404).status).toBe(404);
  });
});
