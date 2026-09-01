export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(
      'El cuerpo de la solicitud no contiene JSON válido',
      400,
    );
  }
}

export function jsonError(message: string, status: number, details?: unknown) {
  return Response.json({ error: message, details }, { status });
}

export function handleApiError(error: unknown, fallbackMessage: string) {
  if (error instanceof HttpError)
    return jsonError(error.message, error.status, error.details);
  console.error(
    'API request failed',
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { type: typeof error },
  );
  return jsonError(fallbackMessage, 500);
}
