import { generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { verifyAccessToken } from '@/lib/auth-token';

let privateKey: CryptoKey;
let publicKey: CryptoKey;
const issuer = 'https://cerca-test.auth0.com/';
const audience = 'https://api.cerca.test';

beforeAll(
  async () => ({ privateKey, publicKey } = await generateKeyPair('RS256')),
);

async function token(
  overrides: {
    issuer?: string;
    audience?: string;
    subject?: string;
    expires?: string;
  } = {},
) {
  let builder = new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(overrides.issuer || issuer)
    .setAudience(overrides.audience || audience)
    .setIssuedAt()
    .setExpirationTime(overrides.expires || '5m');
  if (overrides.subject !== '')
    builder = builder.setSubject(overrides.subject || 'auth0|user-1');
  return builder.sign(privateKey);
}

describe('tokens Auth0', () => {
  it('acepta un token vigente con emisor y audiencia correctos', async () =>
    expect(
      verifyAccessToken(await token(), publicKey, issuer, audience),
    ).resolves.toBe('auth0|user-1'));
  it('rechaza una audiencia ajena', async () =>
    expect(
      verifyAccessToken(
        await token({ audience: 'otra-api' }),
        publicKey,
        issuer,
        audience,
      ),
    ).rejects.toThrow());
  it('rechaza un emisor ajeno', async () =>
    expect(
      verifyAccessToken(
        await token({ issuer: 'https://evil.example/' }),
        publicKey,
        issuer,
        audience,
      ),
    ).rejects.toThrow());
  it('rechaza tokens vencidos o sin usuario', async () => {
    await expect(
      verifyAccessToken(
        await token({ expires: '0s' }),
        publicKey,
        issuer,
        audience,
      ),
    ).rejects.toThrow();
    await expect(
      verifyAccessToken(
        await token({ subject: '' }),
        publicKey,
        issuer,
        audience,
      ),
    ).rejects.toThrow(/no identifica/);
  });
});
