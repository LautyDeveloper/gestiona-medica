import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/lib/password';

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
  });
});
