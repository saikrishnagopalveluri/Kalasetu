'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    // Only register in production. In `next dev`, Turbopack reuses chunk URLs
    // across recompiles instead of content-hashing them the way a real build
    // does, so a service worker registered during development caches a stale
    // version of the app that survives server restarts and full reloads,
    // silently masking every edit until someone thinks to clear it by hand.
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Service worker registration failed:', err)
      })
    }
  }, [])

  return null
}
