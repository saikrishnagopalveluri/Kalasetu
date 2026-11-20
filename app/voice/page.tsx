'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import RequireAuth from '@/components/RequireAuth'
import { LANGUAGES, type LanguageId } from '@/lib/languages'
import { useLanguage } from '@/lib/LanguageProvider'
import { useFollowingState } from '@/lib/useFollowingState'
import { supabase } from '@/lib/supabase'
import { bytesToBase64, encodeWav, peakLevel, toMono16k } from '@/lib/wav'
import type { AgentAction } from '@/lib/voiceAgent'
import type { TranslationKey } from '@/lib/translations'

// Every label comes from the shared dictionary (lib/translations.ts), so
// the screen reads in all 23 languages like the rest of the app.
function useVoiceLabels() {
  const { t } = useLanguage()
  return {
    title: t('voice.title'),
    subtitle: t('voice.subtitle'),
    tapToSpeak: t('voice.tapToSpeak'),
    listening: t('voice.listening'),
    thinking: t('voice.thinking'),
    speaking: t('voice.speaking'),
    language: t('voice.language'),
    you: t('voice.you'),
    saathi: t('voice.saathi'),
    typeHere: t('voice.typeHere'),
    send: t('common.send'),
    speakReplies: t('voice.speakReplies'),
    tryAsking: t('voice.tryAsking'),
    noMic: t('voice.noMic'),
    micDenied: t('voice.micDenied'),
    tooQuiet: t('voice.tooQuiet'),
    badRecording: t('voice.badRecording'),
    busy: t('voice.busy'),
    tooMany: t('common.tooManyRequests'),
    fairPrice: t('voice.fairPrice'),
    online: t('voice.online'),
    minimum: t('voice.minimum'),
    materials: t('voice.materials'),
    labour: t('voice.labour'),
    open: t('voice.open'),
    copy: t('voice.copyLink'),
    copied: t('common.copied'),
    share: t('voice.shareWhatsapp'),
    noCatalogue: t('voice.noCatalogue'),
    deadline: t('voice.deadline'),
    stop: t('voice.stop'),
    examples: [t('voice.example1'), t('voice.example2'), t('voice.example3'), t('voice.example4')],
    screen: (id: string) => t(`voice.screen.${id}` as TranslationKey),
  }
}
type Labels = ReturnType<typeof useVoiceLabels>

type Status = 'idle' | 'recording' | 'thinking' | 'speaking'
type Turn = { id: number; role: 'user' | 'assistant'; text: string; actions?: AgentAction[] }

const MAX_RECORDING_MS = 45_000
const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase?.auth.getSession() ?? { data: { session: null } }
  const token = data.session?.access_token
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

// Decodes whatever the browser recorded and re-encodes it as 16 kHz mono
// WAV, the format Gemini reliably accepts from every browser.
async function blobToWav(blob: Blob): Promise<{ base64: string; peak: number }> {
  const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()
  try {
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer())
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i))
    const samples = toMono16k(channels, buffer.sampleRate)
    return { base64: bytesToBase64(encodeWav(samples)), peak: peakLevel(samples) }
  } finally {
    void ctx.close()
  }
}

function VoicePageInner() {
  const { language: uiLanguage } = useLanguage()
  const [language, setLanguage] = useFollowingState<LanguageId>(uiLanguage)
  const L = useVoiceLabels()

  const [status, setStatus] = useState<Status>('idle')
  const [turns, setTurns] = useState<Turn[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [speakReplies, setSpeakReplies] = useState(true)
  const [seconds, setSeconds] = useState(0)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timersRef = useRef<{ tick?: ReturnType<typeof setInterval>; stop?: ReturnType<typeof setTimeout> }>({})
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const nextId = useRef(1)

  function stopSpeaking() {
    audioRef.current?.pause()
    audioRef.current = null
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setStatus((s) => (s === 'speaking' ? 'idle' : s))
  }

  function speakWithDevice(text: string) {
    if (!('speechSynthesis' in window)) { setStatus('idle'); return }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language === 'en' ? 'en-IN' : `${language}-IN`
    utterance.onend = () => setStatus('idle')
    utterance.onerror = () => setStatus('idle')
    window.speechSynthesis.speak(utterance)
  }

  // Gemini TTS first (natural voice in every Indian language); the
  // phone's own voice if Gemini is busy or rate limited.
  async function speak(text: string) {
    if (!speakReplies || !text) { setStatus('idle'); return }
    setStatus('speaking')
    try {
      const res = await fetch('/api/speak', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ text, language }), signal: AbortSignal.timeout(15_000) })
      if (!res.ok) throw new Error('speech unavailable')
      const { audioDataUrl } = await res.json()
      const audio = new Audio(audioDataUrl)
      audioRef.current = audio
      audio.onended = () => setStatus('idle')
      await audio.play()
    } catch {
      speakWithDevice(text)
    }
  }

  async function ask(payload: { audio?: { mimeType: string; data: string }; text?: string }) {
    setStatus('thinking')
    setNotice(null)
    const history = turns.slice(-8).map((t) => ({ role: t.role, content: t.text }))
    if (payload.text) setTurns((prev) => [...prev, { id: nextId.current++, role: 'user', text: payload.text! }])
    try {
      const res = await fetch('/api/voice-agent', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ ...payload, history, language }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(res.status === 400 ? L.badRecording : res.status === 429 ? L.tooMany : L.busy)
      }
      setTurns((prev) => [
        ...prev,
        ...(payload.audio && data.heard ? [{ id: nextId.current++, role: 'user' as const, text: data.heard }] : []),
        { id: nextId.current++, role: 'assistant', text: data.reply, actions: data.actions },
      ])
      await speak(data.reply)
    } catch (err) {
      setNotice(err instanceof Error && err.message ? err.message : L.busy)
      setStatus('idle')
    }
  }

  function clearTimers() {
    clearInterval(timersRef.current.tick)
    clearTimeout(timersRef.current.stop)
  }

  async function startRecording() {
    stopSpeaking()
    setNotice(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setNotice(L.noMic)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        clearTimers()
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        try {
          const { base64, peak } = await blobToWav(blob)
          if (peak < 0.02) { setNotice(L.tooQuiet); setStatus('idle'); return }
          await ask({ audio: { mimeType: 'audio/wav', data: base64 } })
        } catch {
          setNotice(L.noMic)
          setStatus('idle')
        }
      }
      recorderRef.current = recorder
      recorder.start()
      setSeconds(0)
      setStatus('recording')
      timersRef.current.tick = setInterval(() => setSeconds((s) => s + 1), 1000)
      timersRef.current.stop = setTimeout(() => stopRecording(), MAX_RECORDING_MS)
    } catch {
      setNotice(L.micDenied)
      setStatus('idle')
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      setStatus('thinking')
      recorder.stop()
    }
  }

  function onMicClick() {
    if (status === 'recording') stopRecording()
    else if (status === 'speaking') stopSpeaking()
    else if (status === 'idle') void startRecording()
  }

  function sendTyped(text: string) {
    const q = text.trim()
    if (!q || status === 'thinking' || status === 'recording') return
    stopSpeaking()
    setTyped('')
    void ask({ text: q })
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch { /* clipboard blocked: the link is still visible to copy by hand */ }
  }

  const statusText = status === 'recording' ? `${L.listening} ${seconds}s`
    : status === 'thinking' ? L.thinking
    : status === 'speaking' ? L.speaking
    : L.tapToSpeak

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <style>{`
        @keyframes ks-voice-pulse { 0% { box-shadow: 0 0 0 0 rgba(196,85,45,0.45); } 70% { box-shadow: 0 0 0 26px rgba(196,85,45,0); } 100% { box-shadow: 0 0 0 0 rgba(196,85,45,0); } }
        @keyframes ks-voice-spin { to { transform: rotate(360deg); } }
        @keyframes ks-voice-bar { 0%, 100% { transform: scaleY(0.35); } 50% { transform: scaleY(1); } }
        .ks-voice-mic:focus-visible { outline: 3px solid var(--ks-saffron); outline-offset: 4px; }
        .ks-voice-chip:hover { border-color: var(--ks-clay); color: var(--ks-earth); }
        @media (prefers-reduced-motion: reduce) { .ks-voice-anim { animation: none !important; } }
      `}</style>

      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {L.title}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ks-muted)', lineHeight: 1.55, marginBottom: 16 }}>{L.subtitle}</p>
      <div className="ks-frieze" style={{ marginBottom: 20 }} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ks-muted)' }}>
          {L.language}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageId)}
            disabled={status !== 'idle'}
            style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--ks-border)', background: 'var(--ks-ivory)', fontSize: 14, color: 'var(--ks-earth)' }}
          >
            {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label} ({l.name})</option>)}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ks-muted)', cursor: 'pointer' }}>
          <input type="checkbox" checked={speakReplies} onChange={(e) => { setSpeakReplies(e.target.checked); if (!e.target.checked) stopSpeaking() }} />
          {L.speakReplies}
        </label>
      </div>

      {/* The mic */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '26px 0 18px' }}>
        <button
          type="button"
          className="ks-voice-mic"
          onClick={onMicClick}
          disabled={status === 'thinking'}
          aria-label={status === 'recording' ? L.stop : status === 'speaking' ? L.stop : L.tapToSpeak}
          aria-pressed={status === 'recording'}
          style={{
            width: 132, height: 132, borderRadius: '50%', border: 'none', cursor: status === 'thinking' ? 'wait' : 'pointer',
            background: status === 'recording' ? 'var(--ks-clay)' : 'var(--ks-earth)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
            boxShadow: '0 8px 24px rgba(19,42,69,0.25)', transition: 'background 0.2s',
            animation: status === 'recording' ? 'ks-voice-pulse 1.4s infinite' : undefined,
          }}
        >
          {status === 'thinking' ? (
            <span className="ks-voice-anim" style={{ width: 46, height: 46, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'ks-voice-spin 0.9s linear infinite' }} />
          ) : status === 'speaking' ? (
            <span style={{ display: 'flex', gap: 5, alignItems: 'center', height: 46 }} aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="ks-voice-anim" style={{ width: 6, height: 40, borderRadius: 3, background: 'var(--ks-saffron)', animation: `ks-voice-bar 0.9s ${i * 0.12}s ease-in-out infinite` }} />
              ))}
            </span>
          ) : status === 'recording' ? (
            <span style={{ width: 38, height: 38, borderRadius: 8, background: '#fff' }} aria-hidden="true" />
          ) : (
            <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="17" x2="12" y2="22" />
            </svg>
          )}
        </button>
        <p role="status" aria-live="polite" style={{ marginTop: 16, fontSize: 15, fontWeight: 600, color: status === 'recording' ? 'var(--ks-clay)' : 'var(--ks-earth)', textAlign: 'center', minHeight: 22 }}>
          {statusText}
        </p>
        {notice && (
          <p role="alert" style={{ marginTop: 6, fontSize: 13, color: 'var(--ks-clay)', textAlign: 'center', maxWidth: 420 }}>{notice}</p>
        )}
      </div>

      {/* Typed fallback, also for anyone who cannot or prefers not to speak */}
      <form onSubmit={(e) => { e.preventDefault(); sendTyped(typed) }} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <label htmlFor="voice-typed" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{L.typeHere}</label>
        <input
          id="voice-typed"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={L.typeHere}
          maxLength={2000}
          style={{ flex: 1, minWidth: 0, padding: '12px 14px', borderRadius: 12, border: '1px solid var(--ks-border)', background: 'var(--ks-ivory)', fontSize: 15, color: 'var(--ks-earth)' }}
        />
        <button type="submit" disabled={!typed.trim() || status === 'thinking' || status === 'recording'}
          style={{ padding: '12px 18px', borderRadius: 12, border: 'none', background: 'var(--ks-clay)', color: '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', opacity: !typed.trim() ? 0.6 : 1 }}>
          {L.send}
        </button>
      </form>

      {turns.length === 0 && (
        <div style={{ marginBottom: 22 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ks-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>{L.tryAsking}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {L.examples.map((example) => (
              <button
                key={example}
                type="button"
                className="ks-voice-chip"
                onClick={() => sendTyped(example)}
                disabled={status !== 'idle'}
                style={{ textAlign: 'left', padding: '11px 14px', borderRadius: 12, border: '1px solid var(--ks-border)', background: 'var(--ks-ivory)', color: 'var(--ks-muted)', fontSize: 14, cursor: 'pointer', lineHeight: 1.4 }}
              >
                “{example}”
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
        {turns.map((turn) => (
          <div key={turn.id} style={{ alignSelf: turn.role === 'user' ? 'flex-end' : 'stretch', maxWidth: turn.role === 'user' ? '85%' : '100%' }}>
            <div style={{
              padding: '12px 14px', borderRadius: 14, fontSize: 15, lineHeight: 1.55,
              background: turn.role === 'user' ? 'var(--ks-earth)' : 'var(--ks-ivory)',
              color: turn.role === 'user' ? '#fff' : 'var(--ks-earth)',
              border: turn.role === 'user' ? 'none' : '1px solid var(--ks-border)',
            }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, opacity: 0.7, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {turn.role === 'user' ? L.you : L.saathi}
              </span>
              {turn.text}
              {turn.role === 'assistant' && (
                <button type="button" onClick={() => { stopSpeaking(); void speak(turn.text) }} disabled={status !== 'idle'} aria-label={L.speakReplies}
                  style={{ display: 'inline-flex', marginLeft: 8, verticalAlign: 'middle', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ks-clay)', padding: 2 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>
                </button>
              )}
            </div>
            {turn.actions?.map((action, i) => <ActionCard key={i} action={action} L={L} copiedUrl={copiedUrl} onCopy={copyLink} />)}
          </div>
        ))}
      </div>

    </div>
  )
}

function ActionCard({ action, L, copiedUrl, onCopy }: { action: AgentAction; L: Labels; copiedUrl: string | null; onCopy: (url: string) => void }) {
  const card: React.CSSProperties = { marginTop: 8, padding: 14, borderRadius: 14, background: 'var(--ks-linen)', border: '1px solid var(--ks-border)' }
  const button: React.CSSProperties = { display: 'inline-block', padding: '9px 14px', borderRadius: 10, background: 'var(--ks-earth)', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', border: 'none', cursor: 'pointer' }

  if (action.type === 'price') {
    const r = action.result
    return (
      <div style={card}>
        <div style={{ fontSize: 12, color: 'var(--ks-muted)', fontWeight: 600 }}>{L.fairPrice}</div>
        <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--ks-jade)', fontFamily: 'var(--font-display)' }}>{rupees(r.fairPrice)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 8, fontSize: 13, color: 'var(--ks-earth)' }}>
          <span>{L.materials}: <b>{rupees(r.materials)}</b></span>
          <span>{L.labour}: <b>{rupees(r.labour)}</b></span>
          <span>{L.online}: <b>{rupees(r.onlinePrice)}</b></span>
          <span style={{ color: 'var(--ks-clay)' }}>{L.minimum}: <b>{rupees(r.minimumPrice)}</b></span>
        </div>
      </div>
    )
  }
  if (action.type === 'schemes') {
    return (
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {action.items.map((item) => (
          <a key={item.url + item.title} href={item.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', padding: '10px 12px', borderRadius: 10, background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', textDecoration: 'none', color: 'var(--ks-earth)' }}>
            <b style={{ fontSize: 14 }}>{item.title}</b>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--ks-muted)', marginTop: 2 }}>
              {item.type}{item.deadline ? ` · ${L.deadline}: ${new Date(item.deadline).toLocaleDateString('en-IN')}` : ''} ↗
            </span>
          </a>
        ))}
      </div>
    )
  }
  if (action.type === 'catalogue') {
    if (!action.url) {
      return (
        <div style={card}>
          <p style={{ fontSize: 14, color: 'var(--ks-earth)', marginBottom: 10 }}>{L.noCatalogue}</p>
          <Link href="/catalogue" style={button}>{L.open} →</Link>
        </div>
      )
    }
    return (
      <div style={card}>
        <p style={{ fontSize: 13, color: 'var(--ks-earth)', wordBreak: 'break-all', marginBottom: 10 }}>{action.url}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onCopy(action.url!)} style={{ ...button, background: 'var(--ks-ivory)', color: 'var(--ks-earth)', border: '1px solid var(--ks-border)' }}>
            {copiedUrl === action.url ? L.copied : L.copy}
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(action.url)}`} target="_blank" rel="noopener noreferrer" style={{ ...button, background: 'var(--ks-jade)' }}>{L.share}</a>
        </div>
      </div>
    )
  }
  return (
    <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <b style={{ fontSize: 14, color: 'var(--ks-earth)' }}>{L.screen(action.screen)}</b>
      <Link href={action.path} style={button}>{L.open} →</Link>
    </div>
  )
}

export default function VoicePage() {
  return (
    <RequireAuth>
      <VoicePageInner />
    </RequireAuth>
  )
}
