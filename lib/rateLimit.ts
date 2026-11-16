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

// x-forwarded-for is a chain a client can prepend arbitrary values to —
// taking the first entry (as this used to) lets a caller spoof a fresh key
// on every request and defeat the limiter entirely. Vercel's edge appends
// the real connecting IP as the LAST entry in that chain, and separately
// sets x-real-ip to the same trustworthy value — prefer that.
export function clientKey(request: Request): string {
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const forwarded = request.headers.get('x-forwarded-for')
  if (!forwarded) return 'unknown'
  const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean)
  return parts[parts.length - 1] ?? 'unknown'
}

// For authenticated routes, the caller's user id is a far stronger rate-limit
// key than any IP — not spoofable (it's independently verified by
// requireUser before this is ever called), and correctly separates users
// who share a NAT/office IP instead of throttling them as one.
export function userKey(userId: string): string {
  return `user:${userId}`
}
