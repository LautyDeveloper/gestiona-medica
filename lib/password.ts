const ALGORITHM = 'pbkdf2-sha256';
const ITERATIONS = 210_000;
const KEY_BYTES = 32;

function encode(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function decode(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: Uint8Array.from(salt).buffer,
      iterations,
    },
    key,
    KEY_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export function isPasswordHashSupported(encoded: string) {
  const [algorithm, iterationsText, saltText, expectedText, extra] =
    encoded.split('$');
  const iterations = Number(iterationsText);
  if (
    extra !== undefined ||
    algorithm !== ALGORITHM ||
    !Number.isInteger(iterations) ||
    iterations < 100_000 ||
    !saltText ||
    !expectedText
  )
    return false;
  try {
    return (
      decode(saltText).length === 16 &&
      decode(expectedText).length === KEY_BYTES
    );
  } catch {
    return false;
  }
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return `${ALGORITHM}$${ITERATIONS}$${encode(salt)}$${encode(hash)}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [, iterationsText, saltText, expectedText] = encoded.split('$');
  const iterations = Number(iterationsText);
  if (!isPasswordHashSupported(encoded)) return false;
  try {
    const actual = await derive(password, decode(saltText), iterations);
    const expected = decode(expectedText);
    if (actual.length !== expected.length) return false;
    let difference = 0;
    for (let index = 0; index < actual.length; index += 1)
      difference |= actual[index] ^ expected[index];
    return difference === 0;
  } catch {
    return false;
  }
}
