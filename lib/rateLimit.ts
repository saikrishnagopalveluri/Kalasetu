// Best-effort per-instance rate limiting — no Redis/Upstash in this project,
// so this only throttles requests landing on the same warm serverless
// instance, not truly globally across Vercel's fleet. Real protection here
// comes from the caller being cache-bounded by design (see blog-translate's
// own comment); this is an extra layer on top, not the only one.
const hits = new Map<string, { count: number; resetAt: number }>()

// Keeps the map from growing without bound under sustained traffic across a
// long-lived warm instance.
let lastSweep = Date.now()
function sweep() {
  const now = Date.now()
  if (now - lastSweep < 60_000) return
  lastSweep = now
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key)
  }
}

export function isRateLimited(key: string, max: number, windowMs: number): boolean {
  sweep()
  const now = Date.now()
  const entry = hits.get(key)
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  entry.count++
  return entry.count > max
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : 'unknown'
}
