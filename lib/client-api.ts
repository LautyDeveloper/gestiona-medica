export class ApiError extends Error {
  details?: Record<string, string[]>;

  constructor(message: string, details?: Record<string, string[]>) {
    super(message);
    this.details = details;
  }
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
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
