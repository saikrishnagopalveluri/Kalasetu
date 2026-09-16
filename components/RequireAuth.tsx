'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { supabaseConfigured } from '@/lib/supabase'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!supabaseConfigured) return // no auth backend configured — don't lock the app out
    if (!loading && !user) router.push('/login')
  }, [loading, user, router])

  if (supabaseConfigured && loading) {
    // A skeleton rather than bare "Loading…" text — the wait itself hasn't
    // gotten shorter, but a shimmering placeholder reads as "working," not
    // "stuck," which is what plain text on an empty page reads as.
    return (
      <div aria-busy="true" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="ks-skeleton" style={{ height: 100, width: '100%' }} />
        <div className="ks-skeleton" style={{ height: 20, width: '60%' }} />
        <div className="ks-skeleton" style={{ height: 60, width: '100%' }} />
        <div className="ks-skeleton" style={{ height: 60, width: '100%' }} />
      </div>
    )
  }
  if (supabaseConfigured && !user) {
    return null // redirecting
  }
  return <>{children}</>
}
