import { describe, expect, it } from 'vitest';
import { getBootstrapStatus } from '@/lib/bootstrap-status';
import { hashPassword } from '@/lib/password';

function fakeDb(userCount: number, passwordHashes: string[]) {
  return {
    prepare(sql: string) {
      if (sql.includes('COUNT(*)'))
        return { first: async () => ({ count: userCount }) };
      if (sql.includes('SELECT DISTINCT u.password_hash'))
        return {
          all: async () => ({
            results: passwordHashes.map((passwordHash) => ({ passwordHash })),
          }),
        };
      throw new Error(`Consulta inesperada: ${sql}`);
    },
  } as unknown as D1Database;
}

describe('estado del alta inicial', () => {
  it('requiere configuración cuando no hay usuarios', async () => {
    await expect(getBootstrapStatus(fakeDb(0, []))).resolves.toEqual({
      state: 'setup-required',
      setupRequired: true,
    });
  });

  it('queda listo con un cuidador administrador y hash válido', async () => {
    const passwordHash = await hashPassword('contraseña-segura');
    await expect(
      getBootstrapStatus(fakeDb(1, [passwordHash])),
    ).resolves.toEqual({ state: 'ready', setupRequired: false });
  });

  it('detecta usuarios creados manualmente sin acceso válido', async () => {
    await expect(
      getBootstrapStatus(fakeDb(1, ['contraseña-en-texto-plano'])),
    ).resolves.toEqual({ state: 'invalid', setupRequired: false });
    await expect(getBootstrapStatus(fakeDb(1, []))).resolves.toEqual({
      state: 'invalid',
      setupRequired: false,
    });
  });
});
