'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/useAuth'
import { supabaseConfigured } from '@/lib/supabase'

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!supabaseConfigured) return
    if (loading) return
    if (!user) { router.push('/login'); return }
    if (profile && !profile.is_admin) router.push('/')
  }, [loading, user, profile, router])

  if (!supabaseConfigured) {
    return <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>Admin requires Supabase to be set up.</p>
  }
  if (loading || !profile) {
    return <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>Loading…</p>
  }
  if (!profile.is_admin) {
    return null // redirecting
  }
  return <>{children}</>
}
