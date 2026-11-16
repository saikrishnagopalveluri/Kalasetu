const CACHE_NAME = 'hastkatha-v2'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Never cache API calls (auth, AI generation, Supabase) — these must
  // always be fresh, and caching them would risk showing stale/wrong data.
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/v1/')) {
    return
  }

  if (event.request.method !== 'GET') return

  // Video is fetched with byte-range requests (206 partial responses),
  // which the Cache API refuses to store, and a multi-MB file has no
  // business in this cache anyway. Let the browser handle it directly.
  if (event.request.destination === 'video' || url.pathname.endsWith('.mp4') || event.request.headers.has('range')) return

  // Next.js build output under /_next/static/ is content-hashed — a new
  // deploy ships new filenames, so the old cached ones are simply never
  // requested again. Safe (and fast) to cache-first these.
  const isHashedAsset = url.pathname.startsWith('/_next/static/')

  if (isHashedAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
      })
    )
    return
  }

  // Everything else — page navigations, the manifest, icons — must reflect
  // the latest deploy. Network-first, only falling back to a cached copy
  // when the network is genuinely unreachable (offline support).
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})
