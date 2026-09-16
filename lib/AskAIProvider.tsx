'use client'

import { createContext, useCallback, useContext, useState } from 'react'

type AskAIContextValue = {
  isOpen: boolean
  open: () => void
  close: () => void
}

const AskAIContext = createContext<AskAIContextValue | null>(null)

export function AskAIProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  return (
    <AskAIContext.Provider value={{ isOpen, open, close }}>
      {children}
    </AskAIContext.Provider>
  )
}

export function useAskAI() {
  const ctx = useContext(AskAIContext)
  if (!ctx) throw new Error('useAskAI must be used within AskAIProvider')
  return ctx
}
