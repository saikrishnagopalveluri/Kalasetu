'use client'

import { useState, useCallback } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type AIMode = 'description' | 'caption' | 'pricing' | 'coach' | 'general'

type UseAIReturn = {
  ask: (prompt: string, mode?: AIMode) => Promise<string>
  chat: (messages: Message[], mode?: AIMode) => Promise<string>
  loading: boolean
  error: string | null
  clearError: () => void
}

// ── The hook every component in the app uses to call Claude ──
export function useAI(): UseAIReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const callAPI = useCallback(async (
    messages: Message[],
    mode: AIMode = 'general'
  ): Promise<string> => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, mode }),
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

  // Single-turn: send one prompt, get one response
  const ask = useCallback(async (
    prompt: string,
    mode: AIMode = 'general'
  ): Promise<string> => {
    return callAPI([{ role: 'user', content: prompt }], mode)
  }, [callAPI])

  // Multi-turn: send a full conversation history
  const chat = useCallback(async (
    messages: Message[],
    mode: AIMode = 'general'
  ): Promise<string> => {
    return callAPI(messages, mode)
  }, [callAPI])

  const clearError = useCallback(() => setError(null), [])

  return { ask, chat, loading, error, clearError }
}