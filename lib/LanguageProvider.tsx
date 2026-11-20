'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthProvider'
import { getTranslations, type TranslationKey } from './translations'
import type { LanguageId } from './languages'

const STORAGE_KEY = 'ks_language'

// Urdu, Kashmiri, and Sindhi are written right-to-left (Perso-Arabic script).
// Every other supported language, including Manipuri (Bengali script) and
// Santali (Ol Chiki), is left-to-right.
const RTL_LANGUAGES = new Set<LanguageId>(['ur', 'ks', 'sd'])

type LanguageContextValue = {
  language: LanguageId
  setLanguage: (lang: LanguageId) => void
  t: (key: TranslationKey) => string
  showGate: boolean
  // false until the starting language has been worked out (the gate may
  // still be about to open), so the dashboard guide waits for it.
  languageResolved: boolean
  dismissGate: (lang: LanguageId) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  const [language, setLanguageState] = useState<LanguageId>('en')
  // undefined = not yet determined (avoid a flash of the gate before we've
  // checked localStorage/profile on mount).
  const [showGate, setShowGate] = useState<boolean | undefined>(undefined)
  // Resolves the starting language exactly once per session. After that,
  // nothing but an explicit setLanguage() call (the switcher or the gate) may
  // change it — not a token refresh, not a re-login, not a profile refetch.
  // Without this guard, AuthProvider handing back a fresh `profile` object
  // (which happens on every auth event, including background token renewal)
  // would re-run this resolution and could silently snap the language back,
  // which is exactly the behaviour we must not have.
  const resolvedRef = useRef(false)

  useEffect(() => {
    if (resolvedRef.current) return
    if (loading) return // wait for auth to settle so a logged-in preference isn't missed

    if (profile?.preferred_language) {
      resolvedRef.current = true
      // This effect is the one place the starting language is read from
      // outside React (the signed-in profile and localStorage). Reading
      // localStorage during render would break server rendering, so the
      // state update has to happen here, once per session.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLanguageState(profile.preferred_language as LanguageId)
      setShowGate(false)
      try { localStorage.setItem(STORAGE_KEY, profile.preferred_language) } catch { /* private browsing etc. */ }
      return
    }
    resolvedRef.current = true
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) { setLanguageState(stored as LanguageId); setShowGate(false) }
      else setShowGate(true)
    } catch {
      setShowGate(true)
    }
  }, [loading, profile])

  const setLanguage = useCallback((lang: LanguageId) => {
    setLanguageState(lang)
    try { localStorage.setItem(STORAGE_KEY, lang) } catch { /* private browsing etc. */ }
    if (user && supabase) {
      supabase.from('artisan_profiles').update({ preferred_language: lang }).eq('id', user.id)
        .then(({ error }) => { if (error) console.error('Failed to save language preference:', error.message) })
    }
  }, [user])

  const dismissGate = useCallback((lang: LanguageId) => {
    setLanguage(lang)
    setShowGate(false)
  }, [setLanguage])

  const dict = getTranslations(language)
  const t = useCallback((key: TranslationKey) => dict[key] ?? key, [dict])

  // The <html> tag is server-rendered as lang="en" with no dir attribute
  // (layout.tsx can't know the visitor's language ahead of time), so once
  // the real language resolves client-side we correct both here. dir in
  // particular matters for Urdu/Kashmiri/Sindhi, which are right-to-left
  // scripts, otherwise their text renders left-aligned and reads backwards.
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr'
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, showGate: showGate === true, languageResolved: showGate !== undefined, dismissGate }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}
