import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db', () => ({ getD1: vi.fn() }));

import { AuthError, requireSameOrigin } from '@/lib/server-auth';

describe('protección de solicitudes mutantes', () => {
  it('acepta solicitudes del mismo origen y clientes sin Origin', () => {
    expect(() =>
      requireSameOrigin(
        new Request('https://cerca.example/api/data', {
          headers: { Origin: 'https://cerca.example' },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      requireSameOrigin(new Request('https://cerca.example/api/data')),
    ).not.toThrow();
  });

  it('rechaza Origin diferente y navegación marcada como cross-site', () => {
    const unsafeHeaders: HeadersInit[] = [
      { Origin: 'https://malicioso.example' },
      { 'Sec-Fetch-Site': 'cross-site' },
    ];
    for (const headers of unsafeHeaders) {
      expect(() =>
        requireSameOrigin(
          new Request('https://cerca.example/api/data', { headers }),
        ),
      ).toThrow(AuthError);
    }
  });
});
