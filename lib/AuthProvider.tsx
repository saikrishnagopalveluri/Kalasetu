'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type ArtisanProfile = {
  id: string
  name: string
  business_name: string | null
  about: string | null
  profile_photo_url: string | null
  phone: string | null
  craft_type: string | null
  state: string | null
  preferred_language: string
  years_active: number | null
  income_range: string | null
  vishwakarma_eligible: string | null
  subscription_tier: string
  subscription_period: string | null
  subscription_renews_at: string | null
  is_admin: boolean
  public_slug: string | null
  catalogue_published: boolean
  public_contact_phone: string | null
  languages_known: string[] | null
  terms_accepted_at: string | null
  terms_version: string | null
  created_at: string
}

export type SignupDetails = {
  email: string
  password: string
  name: string
  phone: string
  craftType: string
  state: string
  preferredLanguage: string
  yearsActive: string
  incomeRange: string
  vishwakarmaEligible: string
}

type AuthContextValue = {
  user: User | null
  profile: ArtisanProfile | null
  loading: boolean
  error: string | null
  clearError: () => void
  signUp: (details: SignupDetails) => Promise<boolean>
  logIn: (email: string, password: string) => Promise<boolean>
  logOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ArtisanProfile | null>(null)
  const [loading, setLoading] = useState(() => Boolean(supabase))
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return
    const { data } = await supabase.from('artisan_profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data)
  }, [])

  useEffect(() => {
    if (!supabase) return

    supabase.auth.getSession().then(async ({ data }) => {
      setUser(data.session?.user ?? null)
      // Wait for the profile fetch too, not just the session — otherwise
      // `loading` flips to false while `profile` is still null, and every
      // consumer that gates on `!loading` (RequireAuth, page greetings,
      // language resolution) briefly renders a "no profile yet" fallback
      // state (e.g. a generic greeting instead of the artisan's real name)
      // before correcting itself a moment later.
      if (data.session?.user) await loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) await loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => listener.subscription.unsubscribe()
  }, [loadProfile])

  const signUp = useCallback(async (details: SignupDetails): Promise<boolean> => {
    if (!supabase) { setError('Sign up is not available right now.'); return false }
    setError(null)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: details.email,
      password: details.password,
      options: {
        data: {
          name: details.name,
          phone: details.phone || null,
          craft_type: details.craftType || null,
          state: details.state || null,
          preferred_language: details.preferredLanguage,
          years_active: details.yearsActive || '',
          income_range: details.incomeRange || null,
          vishwakarma_eligible: details.vishwakarmaEligible || null,
        },
      },
    })
    if (signUpError) { setError(signUpError.message); return false }
    if (!data.user) { setError('Something went wrong creating your account.'); return false }

    setUser(data.user)
    if (data.session) await loadProfile(data.user.id)
    return true
  }, [loadProfile])

  const logIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (!supabase) { setError('Login is not available right now.'); return false }
    setError(null)
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) { setError(loginError.message); return false }
    setUser(data.user)
    if (data.user) await loadProfile(data.user.id)
    return true
  }, [loadProfile])

  const logOut = useCallback(async () => {
    await supabase?.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, profile, loading, error, clearError: () => setError(null), signUp, logIn, logOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
