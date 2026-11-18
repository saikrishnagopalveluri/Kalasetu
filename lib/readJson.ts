// Parses a request body as a JSON object without ever throwing. Malformed
// JSON, an empty body, or a non-object payload (null, an array, a bare
// string) all come back as {}, so each route's own field validation can
// answer with a clear 400 instead of the request crashing into a 500.
export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()
    return body !== null && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}
