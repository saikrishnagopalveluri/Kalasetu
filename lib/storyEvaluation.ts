'use client'

import { useState, useCallback } from 'react'
import { supabase } from './supabase'
import type { StoryScores } from '@/app/api/story-evaluate/route'

export type { StoryScores }

export function useStoryEvaluation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const evaluate = useCallback(async (title: string, content: string, language: string): Promise<StoryScores | null> => {
    setLoading(true)
    setError(null)
    try {
      const { data: sessionData } = await supabase?.auth.getSession() ?? { data: { session: null } }
      const accessToken = sessionData.session?.access_token
      const response = await fetch('/api/story-evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ title, content, language }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Evaluation failed')
      }
      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation unavailable. Please try again.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { evaluate, loading, error, clearError: () => setError(null) }
}
