import { jwtVerify, type JWTVerifyGetKey, type CryptoKey } from 'jose';

export async function verifyAccessToken(
  token: string,
  key: CryptoKey | Uint8Array | JWTVerifyGetKey,
  issuer: string,
  audience: string,
) {
  const verified = await jwtVerify(token, key, { issuer, audience });
  if (!verified.payload.sub)
    throw new Error('El token no identifica a un usuario');
  return verified.payload.sub;
}
