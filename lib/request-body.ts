export class PayloadTooLargeError extends Error {}

export async function readJsonWithLimit(
  request: Request,
  maximumBytes: number,
): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes)
    throw new PayloadTooLargeError();

  if (!request.body) return JSON.parse('');

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let json = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > maximumBytes) {
        await reader.cancel();
        throw new PayloadTooLargeError();
      }
      json += decoder.decode(value, { stream: true });
    }
    json += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return JSON.parse(json);
}
