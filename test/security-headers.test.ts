import { describe, expect, it } from 'vitest';
import nextConfig from '@/next.config';

describe('cabeceras de seguridad', () => {
  it('protege todas las rutas y evita cachear respuestas de API', async () => {
    const rules = await nextConfig.headers?.();
    const globalHeaders = rules?.find((rule) => rule.source === '/:path*');
    const apiHeaders = rules?.find((rule) => rule.source === '/api/:path*');

    expect(globalHeaders?.headers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'Content-Security-Policy' }),
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ]),
    );
    expect(apiHeaders?.headers).toContainEqual({
      key: 'Cache-Control',
      value: 'private, no-store, max-age=0',
    });
  });
});
