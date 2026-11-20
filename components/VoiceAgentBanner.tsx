'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/LanguageProvider'

// Home-screen entry point for Saathi Voice. Labels for the three
// most-used languages, English otherwise.
const TEXT: Record<string, { title: string; desc: string; cta: string }> = {
  en: { title: 'Talk to Saathi', desc: 'Ask in your own language. Saathi prices your work, finds schemes and opens the right tool for you.', cta: 'Speak now' },
  hi: { title: 'साथी से बात करें', desc: 'अपनी भाषा में पूछें। साथी दाम बताता है, योजनाएं ढूंढता है और सही टूल खोलता है।', cta: 'अभी बोलें' },
  te: { title: 'సాథీతో మాట్లాడండి', desc: 'మీ భాషలో అడగండి. సాథీ ధర చెబుతుంది, పథకాలు వెతుకుతుంది, సరైన టూల్ తెరుస్తుంది.', cta: 'ఇప్పుడే మాట్లాడండి' },
}

export default function VoiceAgentBanner() {
  const { language } = useLanguage()
  const text = TEXT[language] ?? TEXT.en
  return (
    <Link
      href="/voice"
      style={{
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, padding: '16px 18px',
        borderRadius: 16, textDecoration: 'none', color: '#fff',
        background: 'linear-gradient(120deg, var(--ks-earth) 0%, #1F3D5E 60%, var(--ks-clay) 140%)',
        boxShadow: '0 6px 18px rgba(19,42,69,0.22)',
      }}
    >
      <span aria-hidden="true" style={{
        flexShrink: 0, width: 54, height: 54, borderRadius: '50%', background: 'var(--ks-clay)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 6px rgba(255,255,255,0.12)',
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="17" x2="12" y2="22" />
        </svg>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>{text.title}</span>
        <span style={{ display: 'block', fontSize: 13, lineHeight: 1.45, opacity: 0.88, marginTop: 2 }}>{text.desc}</span>
      </span>
      <style>{'@media (max-width: 440px) { .ks-voice-cta { display: none; } }'}</style>
      <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 700, color: 'var(--ks-saffron)', whiteSpace: 'nowrap' }} className="ks-voice-cta">
        {text.cta} →
      </span>
    </Link>
  )
}
