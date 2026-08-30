import { afterEach, describe, expect, it, vi } from 'vitest';

const dbMock = vi.hoisted(() => ({ getD1: vi.fn() }));

vi.mock('@/db', () => ({ getD1: dbMock.getD1 }));

import { GET } from '@/app/api/auth/bootstrap/route';
import { hashPassword } from '@/lib/password';

function fakeDb(userCount: number, passwordHashes: string[] = []) {
  return {
    prepare(sql: string) {
      if (sql.includes('COUNT(*)'))
        return { first: async () => ({ count: userCount }) };
      return {
        all: async () => ({
          results: passwordHashes.map((passwordHash) => ({ passwordHash })),
        }),
      };
    },
  } as unknown as D1Database;
}

afterEach(() => {
  vi.restoreAllMocks();
  dbMock.getD1.mockReset();
});

describe('API de estado del alta inicial', () => {
  it('expone el estado y el campo compatible', async () => {
    dbMock.getD1.mockReturnValue(fakeDb(0));
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      state: 'setup-required',
      setupRequired: true,
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('detecta una configuración lista e inválida', async () => {
    const passwordHash = await hashPassword('contraseña-segura');
    dbMock.getD1.mockReturnValueOnce(fakeDb(1, [passwordHash]));
    await expect((await GET()).json()).resolves.toMatchObject({
      state: 'ready',
    });

    dbMock.getD1.mockReturnValueOnce(fakeDb(1));
    await expect((await GET()).json()).resolves.toMatchObject({
      state: 'invalid',
    });
  });

  it('devuelve un error de infraestructura explícito', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    dbMock.getD1.mockImplementation(() => {
      throw new Error('no such table: users');
    });
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'La base de datos no está preparada o no está disponible',
      code: 'DATABASE_UNAVAILABLE',
    });
  });
});
