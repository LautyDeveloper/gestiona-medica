export class ApiError extends Error {
  details?: Record<string, string[]>;

  constructor(message: string, details?: Record<string, string[]>) {
    super(message);
    this.details = details;
  }
}

let accessTokenProvider: null | (() => Promise<string>) = null;
export function setAccessTokenProvider(
  provider: null | (() => Promise<string>),
) {
  accessTokenProvider = provider;
}

export async function authorizedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  if (accessTokenProvider)
    headers.set('Authorization', `Bearer ${await accessTokenProvider()}`);
  return fetch(input, { ...init, headers });
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await authorizedFetch(input, init);
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    details?: Record<string, string[]>;
  } & T;
  if (!response.ok)
    throw new ApiError(
      payload.error || 'Ocurrió un error inesperado',
      payload.details,
    );
  return payload;
}
