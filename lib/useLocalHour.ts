'use client'

import { useSyncExternalStore } from 'react'

// The visitor's local hour (0-23), re-read every minute so a painted sky or a
// "Good morning" turns over while the page stays open. Returns null while the
// page is being server-rendered and hydrated (the server's clock and timezone
// are not the visitor's), so callers should render a neutral default then.

function subscribe(onChange: () => void) {
  const timer = setInterval(onChange, 60_000)
  return () => clearInterval(timer)
}

const getHour = () => new Date().getHours()
const getServerHour = () => null

export function useLocalHour(): number | null {
  return useSyncExternalStore(subscribe, getHour, getServerHour)
}
