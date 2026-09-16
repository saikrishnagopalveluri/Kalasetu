'use client'

import { useEffect, useRef, useState } from 'react'
import { useAI } from '@/lib/useAI'
import { useAskAI } from '@/lib/AskAIProvider'
import { useLanguage } from '@/lib/LanguageProvider'
import { LANGUAGES } from '@/lib/languages'

type Msg = { role: 'user' | 'assistant'; content: string }

export default function AskAIModal() {
  const { isOpen, close } = useAskAI()
  const { t, language: uiLanguage } = useLanguage()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [language, setLanguage] = useState<typeof LANGUAGES[number]['id']>(uiLanguage)
  const { chat, loading, error, clearError } = useAI()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, isOpen])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    if (isOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, close])

  async function send(text: string) {
    if (!text.trim() || loading) return
    clearError()
    const next: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')

    const reply = await chat(next, 'coach', language)
    if (reply) setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
  }

  if (!isOpen) return null

  const QUICK_QUESTIONS = [
    { emoji: '💰', text: t('coach.q1') },
    { emoji: '📱', text: t('coach.q2') },
    { emoji: '🏛️', text: t('coach.q3') },
    { emoji: '📦', text: t('coach.q4') },
  ]

  return (
    <div
      onClick={close}
      className="ks-ask-overlay"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(19,42,69,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 0,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ks-pop-in ks-ask-dialog"
        style={{
          background: 'var(--ks-paper)', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 600,
          height: 'min(80vh, 640px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: '1px solid var(--ks-border)', background: 'var(--ks-earth)',
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: '#fff' }}>{t('coach.title')}</div>
            <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{t('coach.subtitle')}</div>
          </div>
          <button
            onClick={close}
            aria-label={t('common.close')}
            style={{
              background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 8,
              width: 30, height: 30, fontSize: 16, cursor: 'pointer', flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: '10px 18px 0' }}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as typeof language)}
            style={{
              background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 8,
              padding: '6px 9px', fontSize: 12.5, fontFamily: 'var(--font-body)',
              color: 'var(--ks-earth)', width: 'auto', minWidth: 180,
            }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id}>{l.label} ({l.name})</option>
            ))}
          </select>
        </div>

        {/* Conversation */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.length === 0 && (
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ks-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                {t('coach.tryAsking')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q.text}
                    onClick={() => send(q.text)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                      background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)',
                      borderRadius: 10, padding: '12px 14px', fontSize: 13.5,
                      color: 'var(--ks-earth)', fontFamily: 'var(--font-body)', cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 17 }}>{q.emoji}</span>
                    {q.text}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: m.role === 'user' ? 'var(--ks-indigo)' : 'var(--ks-ivory)',
                color: m.role === 'user' ? '#fff' : 'var(--ks-earth)',
                border: m.role === 'user' ? 'none' : '1px solid var(--ks-border)',
                borderRadius: 14, padding: '10px 14px', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          ))}

          {loading && (
            <div style={{
              alignSelf: 'flex-start', background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)',
              borderRadius: 14, padding: '10px 14px', fontSize: 13, color: 'var(--ks-muted)',
            }}>
              {t('coach.thinking')}
            </div>
          )}

          {error && (
            <div style={{
              alignSelf: 'flex-start', background: 'rgba(161,61,46,0.1)', color: 'var(--ks-clay)',
              borderRadius: 10, padding: '10px 14px', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ display: 'flex', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--ks-border)' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(input) }}
            placeholder={t('coach.inputPlaceholder')}
            style={{
              flex: 1, background: '#fff', border: '1px solid var(--ks-border)',
              borderRadius: 10, padding: '12px 14px', fontSize: 14,
              fontFamily: 'var(--font-body)', color: 'var(--ks-earth)',
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={loading}
            style={{
              background: 'var(--ks-indigo)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '0 20px', fontSize: 14, fontWeight: 600,
              fontFamily: 'var(--font-body)', cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {t('common.send')}
          </button>
        </div>
      </div>

      {/* Below ~640px this stays a bottom sheet (thumb-reachable, matches the
          rest of the app's mobile chrome). Above it, a bottom sheet just
          reads as "stuck to the bottom of the screen" instead of a normal
          centered dialog, so it switches to one. */}
      <style jsx>{`
        @media (min-width: 640px) {
          :global(.ks-ask-overlay) {
            align-items: center !important;
            padding: 24px !important;
          }
          :global(.ks-ask-dialog) {
            border-radius: 18px !important;
            height: min(640px, 85vh) !important;
          }
        }
      `}</style>
    </div>
  )
}
