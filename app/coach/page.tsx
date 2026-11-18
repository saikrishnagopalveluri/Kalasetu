'use client'

import { useState, useRef, useEffect } from 'react'
import { useFollowingState } from '@/lib/useFollowingState'
import { useAI } from '@/lib/useAI'
import RequireAuth from '@/components/RequireAuth'
import { LANGUAGES } from '@/lib/languages'
import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'

type Msg = { role: 'user' | 'assistant'; content: string }

const QUICK_QUESTIONS: { emoji: string; key: TranslationKey }[] = [
  { emoji: '💰', key: 'coach.q1' },
  { emoji: '📱', key: 'coach.q2' },
  { emoji: '🏛️', key: 'coach.q3' },
  { emoji: '📦', key: 'coach.q4' },
]

function CoachPageInner() {
  const { t, language: uiLanguage } = useLanguage()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [language, setLanguage] = useFollowingState<typeof LANGUAGES[number]['id']>(uiLanguage)
  // See app/content/page.tsx for why this follows the site's own language
  // rather than always starting at English.
  const { chat, loading, error, clearError } = useAI()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text: string) {
    if (!text.trim() || loading) return
    clearError()
    const next: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')

    const reply = await chat(next, 'coach', language)
    if (reply) {
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '60vh' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1.15 }}>💬</span>
        <div>
          <h1 style={pageTitleStyle}>{t('coach.title')}</h1>
          <p style={pageSubtitleStyle}>{t('coach.subtitle')}</p>
        </div>
      </div>
      <div className="ks-frieze" style={{ marginBottom: 18 }} />

      {/* 'content.language' is just the word "Language" in all three languages, reused here rather than adding a new key */}
      <label htmlFor="coach-language-select" style={{ ...sectionLabel, display: 'block' }}>{t('content.language')}</label>
      <select
        id="coach-language-select"
        value={language}
        onChange={(e) => setLanguage(e.target.value as typeof language)}
        style={{
          background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 8,
          padding: '9px 10px', fontSize: 13, fontFamily: 'var(--font-body)',
          color: 'var(--ks-earth)', marginBottom: 18, width: 'auto', minWidth: 200,
        }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.id} value={l.id}>{l.label} ({l.name})</option>
        ))}
      </select>

      {/* Conversation */}
      <div
        role="log"
        aria-live="polite"
        aria-label={t('coach.title')}
        style={{
          flex: 1, display: 'flex', flexDirection: 'column', gap: 12,
          marginBottom: 18, minHeight: 200,
        }}
      >
        {messages.length === 0 && (
          <div>
            <p id="coach-suggestions-heading" style={sectionLabel}>
              {t('coach.tryAsking')}
            </p>
            <div role="group" aria-labelledby="coach-suggestions-heading" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => send(t(q.key))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                    background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)',
                    borderRadius: 10, padding: '13px 14px', fontSize: 13.5,
                    color: 'var(--ks-earth)', fontFamily: 'var(--font-body)',
                  }}
                >
                  <span style={{ fontSize: 17 }} aria-hidden="true">{q.emoji}</span>
                  {t(q.key)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className="ks-pop-in"
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background: m.role === 'user' ? 'var(--ks-indigo)' : 'var(--ks-ivory)',
              color: m.role === 'user' ? '#fff' : 'var(--ks-earth)',
              border: m.role === 'user' ? 'none' : '1px solid var(--ks-border)',
              borderRadius: 14,
              padding: '11px 14px',
              fontSize: 14,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}
          >
            {m.content}
          </div>
        ))}

        {loading && (
          <div style={{
            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)',
            borderRadius: 14, padding: '11px 14px', fontSize: 13, color: 'var(--ks-muted)',
          }}>
            <span className="ks-typing" aria-hidden="true">
              <span /><span /><span />
            </span>
            {t('coach.thinking')}
          </div>
        )}

        {error && (
          <div role="alert" style={{
            alignSelf: 'flex-start', display: 'flex', gap: 8, alignItems: 'flex-start',
            background: 'rgba(196,85,45,0.08)', border: '1px solid rgba(196,85,45,0.3)',
            borderLeft: '3px solid var(--ks-clay)', borderRadius: 10, padding: '11px 14px', maxWidth: '85%',
          }}>
            <span aria-hidden="true" style={{ fontSize: 15 }}>⚠️</span>
            <p style={{ fontSize: 13, color: 'var(--ks-earth)', lineHeight: 1.5 }}>{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 76, background: 'var(--ks-paper)', paddingTop: 6 }}>
        <label htmlFor="coach-input" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {t('coach.inputPlaceholder')}
        </label>
        <input
          id="coach-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(input) }}
          placeholder={t('coach.inputPlaceholder')}
          style={{
            flex: 1, background: '#fff', border: '1px solid var(--ks-border)',
            borderRadius: 10, padding: '13px 14px', fontSize: 14,
            fontFamily: 'var(--font-body)', color: 'var(--ks-earth)', minWidth: 0,
          }}
        />
        <button
          type="button"
          onClick={() => send(input)}
          disabled={loading}
          style={{
            background: 'var(--ks-indigo)', color: '#fff', border: 'none',
            borderRadius: 10, padding: '0 22px', fontSize: 14, fontWeight: 600,
            fontFamily: 'var(--font-body)', cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.7 : 1, flexShrink: 0,
          }}
        >
          {t('common.send')}
        </button>
      </div>

      <style jsx>{`
        .ks-typing { display: inline-flex; gap: 3px; align-items: center; }
        .ks-typing span {
          width: 5px; height: 5px; border-radius: 50%; background: var(--ks-muted);
          animation: ks-bounce 1.1s ease-in-out infinite;
        }
        .ks-typing span:nth-child(2) { animation-delay: 0.15s; }
        .ks-typing span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes ks-bounce {
          0%, 60%, 100% { opacity: 0.35; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ks-typing span { animation: none; opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

const pageTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ks-earth)', marginBottom: 4,
}

const pageSubtitleStyle: React.CSSProperties = {
  fontSize: 13.5, color: 'var(--ks-muted)', lineHeight: 1.55,
}

const sectionLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--ks-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10,
}

export default function CoachPage() {
  return (
    <RequireAuth>
      <CoachPageInner />
    </RequireAuth>
  )
}
