'use client'

import { useState, useCallback } from 'react'
import type { LanguageId } from './languages'
import { supabase } from './supabase'

type Message = { role: 'user' | 'assistant'; content: string }
type AIMode = 'description' | 'craft_story' | 'caption' | 'whatsapp' | 'facebook' | 'catalogue' | 'pricing' | 'coach' | 'general' | 'design_inspiration'
type Language = LanguageId

export function useAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const callAPI = useCallback(async (
    messages: Message[],
    mode: AIMode = 'general',
    language?: Language,
  ): Promise<string> => {
    setLoading(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase?.auth.getSession() ?? { data: { session: null } }
      const accessToken = sessionData.session?.access_token
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ messages, mode, language }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Something went wrong')
      }
      const data = await response.json()
      return data.text
    } catch (err) {
      const message = err instanceof Error ? err.message : 'AI unavailable. Please try again.'
      setError(message)
      return ''
    } finally {
      setLoading(false)
    }
  }, [])

  const ask = useCallback((prompt: string, mode: AIMode = 'general', language?: Language) =>
    callAPI([{ role: 'user', content: prompt }], mode, language), [callAPI])

  const chat = useCallback((messages: Message[], mode: AIMode = 'general', language?: Language) =>
    callAPI(messages, mode, language), [callAPI])

  return { ask, chat, loading, error, clearError: () => setError(null) }
}
