'use client'

import Link from 'next/link'
import { useId, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import RequireAuth from '@/components/RequireAuth'
import { useLanguage } from '@/lib/LanguageProvider'
import { LANGUAGES } from '@/lib/languages'
import { useStoryEvaluation, type StoryScores } from '@/lib/storyEvaluation'
import type { TranslationKey } from '@/lib/translations'
import { STORY_CATEGORIES as CATEGORIES } from '@/lib/storyCategories'

const SCORE_ROWS: { key: keyof StoryScores; labelKey: TranslationKey }[] = [
  { key: 'storytelling', labelKey: 'community.score.storytelling' },
  { key: 'clarity', labelKey: 'community.score.clarity' },
  { key: 'authenticity', labelKey: 'community.score.authenticity' },
  { key: 'craftRelevance', labelKey: 'community.score.craftRelevance' },
  { key: 'culturalContext', labelKey: 'community.score.culturalContext' },
  { key: 'informationalValue', labelKey: 'community.score.informationalValue' },
  { key: 'readability', labelKey: 'community.score.readability' },
]

const PUBLISH_THRESHOLD = 8

function StoryComposerInner() {
  const { user, profile } = useAuth()
  const { t, language: uiLanguage } = useLanguage()
  const { evaluate, loading, error, clearError } = useStoryEvaluation()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0].value)
  const [language, setLanguage] = useState<typeof LANGUAGES[number]['id']>(profile?.preferred_language as typeof LANGUAGES[number]['id'] ?? uiLanguage)
  const [scores, setScores] = useState<StoryScores | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [published, setPublished] = useState(false)

  const fieldIds = { title: useId(), content: useId(), category: useId(), language: useId() }

  async function handleCheck() {
    if (!title.trim() || !content.trim()) return
    clearError()
    setScores(null)
    const result = await evaluate(title, content, language)
    if (result) setScores(result)
  }

  async function handlePublish() {
    if (!user) return
    setPublishing(true)
    setPublishError('')

    const { data: sessionData } = await supabase!.auth.getSession()
    const accessToken = sessionData.session?.access_token
    if (!accessToken) { setPublishing(false); setPublishError(t('community.publishFailed')); return }

    // The score shown on screen is only ever a preview — the server
    // re-evaluates the story itself and is the only thing that can actually
    // set it to PUBLISHED, so there's nothing for the client to fake here.
    const res = await fetch('/api/story-publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ title, content, language, category }),
    })
    setPublishing(false)
    if (!res.ok) { setPublishError(t('community.publishFailed')); return }
    const result = await res.json()
    if (!result.published) {
      // Server re-scored it below threshold (rare — the preview already
      // showed this) — surface the server's own score/feedback so the UI
      // stays consistent with what actually happened.
      setScores(result.scores)
      return
    }
    setPublished(true)
  }

  if (published) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 16px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden="true">🎉</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ks-earth)', marginBottom: 10 }}>
          {t('community.publishedTitle')}
        </h1>
        <Link href="/community" style={{ color: 'var(--ks-indigo)', fontWeight: 600, fontSize: 14 }}>{t('community.viewCommunity')}</Link>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('community.newStory')}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ks-muted)', marginBottom: 16, lineHeight: 1.6, maxWidth: 520 }}>
        {t('community.newStorySubtitle')}
      </p>
      <div className="ks-frieze" style={{ marginBottom: 22 }} />

      <div style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <Field label={t('community.field.title')} htmlFor={fieldIds.title}>
          <input id={fieldIds.title} value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label={t('community.field.category')} htmlFor={fieldIds.category}>
            <select id={fieldIds.category} value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{t(c.key)}</option>)}
            </select>
          </Field>
          <Field label={t('community.field.language')} htmlFor={fieldIds.language}>
            <select id={fieldIds.language} value={language} onChange={(e) => setLanguage(e.target.value as typeof language)} style={{ ...inputStyle, marginBottom: 0 }}>
              {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label} ({l.name})</option>)}
            </select>
          </Field>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--ks-muted)', marginTop: -4, marginBottom: 12, lineHeight: 1.5 }}>
          {t('community.languageHint')}
        </p>
        <Field label={t('community.field.content')} htmlFor={fieldIds.content}>
          <textarea
            id={fieldIds.content} value={content} onChange={(e) => setContent(e.target.value)} rows={10}
            placeholder={t('community.contentPlaceholder')}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, marginBottom: 0 }}
          />
        </Field>

        {error && <p role="alert" style={{ color: 'var(--ks-clay)', fontSize: 12.5, fontWeight: 500, marginTop: 12 }}>{error}</p>}

        <button onClick={handleCheck} disabled={loading || !title.trim() || !content.trim()} style={{ ...primaryBtn, marginTop: 16, width: '100%' }}>
          {loading ? t('community.checking') : t('community.checkWithAI')}
        </button>
      </div>

      {scores && (
        <div className="ks-pop-in" style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ks-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
            {t('community.qualityTitle')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {SCORE_ROWS.map((row) => (
              <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, color: 'var(--ks-earth)' }}>
                <span>{t(row.labelKey)}</span>
                <span style={{ fontWeight: 600 }}>{scores[row.key]}/10</span>
              </div>
            ))}
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 14px', borderRadius: 10,
            background: scores.overall >= PUBLISH_THRESHOLD ? 'rgba(15,91,78,0.1)' : 'rgba(212,160,23,0.14)',
            marginBottom: scores.feedback ? 14 : 0,
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ks-earth)' }}>{t('community.overallScore')}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: scores.overall >= PUBLISH_THRESHOLD ? 'var(--ks-jade)' : 'var(--ks-turmeric)' }}>
              {scores.overall.toFixed(1)}/10
            </span>
          </div>

          {scores.feedback && (
            <p style={{ fontSize: 13, color: 'var(--ks-earth)', lineHeight: 1.6, marginBottom: 4, fontStyle: 'italic' }}>
              {scores.feedback}
            </p>
          )}

          {publishError && <p role="alert" style={{ color: 'var(--ks-clay)', fontSize: 12.5, fontWeight: 500, marginTop: 12 }}>{publishError}</p>}

          {scores.overall >= PUBLISH_THRESHOLD ? (
            <p style={{ fontSize: 13.5, color: 'var(--ks-jade)', fontWeight: 600, marginTop: 14, marginBottom: 12 }}>
              {t('community.readyToPublish')}
            </p>
          ) : null}

          <button
            onClick={scores.overall >= PUBLISH_THRESHOLD ? handlePublish : handleCheck}
            disabled={publishing || loading}
            style={{ ...primaryBtn, width: '100%', marginTop: scores.overall >= PUBLISH_THRESHOLD ? 0 : 14 }}
          >
            {scores.overall >= PUBLISH_THRESHOLD
              ? (publishing ? t('community.publishing') : t('community.publishStory'))
              : t('community.improveWithAI')}
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ks-muted)', marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 8,
  padding: '11px 12px', fontSize: 16, fontFamily: 'var(--font-body)', color: 'var(--ks-earth)', marginBottom: 12,
}
const primaryBtn: React.CSSProperties = {
  background: 'var(--ks-indigo)', color: '#fff', border: 'none', borderRadius: 9,
  padding: '12px 20px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 46,
}

export default function StoryComposerPage() {
  return (
    <RequireAuth>
      <StoryComposerInner />
    </RequireAuth>
  )
}
