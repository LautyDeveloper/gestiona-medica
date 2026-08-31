import { describe, expect, it } from 'vitest';
import {
  hashPassword,
  isPasswordHashSupported,
  verifyPassword,
} from '@/lib/password';

const createTestPassword = () => `test-${crypto.randomUUID()}`;

describe('contraseñas locales', () => {
  it('valida la contraseña correcta y rechaza una incorrecta', async () => {
    const password = createTestPassword();
    const encoded = await hashPassword(password);
    await expect(verifyPassword(password, encoded)).resolves.toBe(true);
    await expect(verifyPassword(createTestPassword(), encoded)).resolves.toBe(
      false,
    );
  });

  it('usa un salt distinto y nunca incluye la contraseña original', async () => {
    const password = createTestPassword();
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(second).not.toContain(password);
  });

  it('rechaza hashes dañados o con parámetros inseguros', async () => {
    const password = createTestPassword();
    const malformedHash = ['invalid', 'hash'].join('-');
    const unsafeHash = ['pbkdf2-sha256', '10', 'c2FsdA', 'aGFzaA'].join('$');

    await expect(verifyPassword(password, malformedHash)).resolves.toBe(false);
    await expect(verifyPassword(password, unsafeHash)).resolves.toBe(false);
    expect(isPasswordHashSupported(malformedHash)).toBe(false);
    expect(isPasswordHashSupported(unsafeHash)).toBe(false);
  });

  it('reconoce el formato de hash usado por la aplicación', async () => {
    const hash = await hashPassword(createTestPassword());
    expect(isPasswordHashSupported(hash)).toBe(true);
    expect(hash.split('$')[1]).toBe('100000');
  });
});
