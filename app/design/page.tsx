'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import { useAI } from '@/lib/useAI'
import RequireAuth from '@/components/RequireAuth'
import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'
import GenerationFeedback from '@/components/GenerationFeedback'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'
import { removeFromStorage } from '@/lib/storageCleanup'

const CRAFT_TYPES: { value: string; key: TranslationKey }[] = [
  { value: 'Handloom weaving', key: 'craft.handloom' },
  { value: 'Kalamkari', key: 'craft.kalamkari' },
  { value: 'Silver filigree', key: 'craft.filigree' },
  { value: 'Leather craft', key: 'craft.leather' },
  { value: 'Block printing', key: 'craft.block' },
  { value: 'Pottery', key: 'craft.pottery' },
  { value: 'Embroidery', key: 'craft.embroidery' },
  { value: 'Other', key: 'craft.other' },
]

const THEMES = [
  { id: 'nature', emoji: '🌿', labelKey: 'design.theme.nature' },
  { id: 'temples', emoji: '🛕', labelKey: 'design.theme.temples' },
  { id: 'history', emoji: '📜', labelKey: 'design.theme.history' },
  { id: 'mythology', emoji: '🪔', labelKey: 'design.theme.mythology' },
  { id: 'culture', emoji: '🎭', labelKey: 'design.theme.culture' },
  { id: 'geography', emoji: '🗺️', labelKey: 'design.theme.geography' },
  { id: 'motifs', emoji: '🔶', labelKey: 'design.theme.motifs' },
] as const satisfies readonly { id: string; emoji: string; labelKey: TranslationKey }[]

type DesignResult = {
  designIdea: string
  designDirection: string
  story: string
  factNote: string | null
  interpretationNote: string
}

type SavedIdea = {
  id: string
  craft_type: string
  theme: string
  notes: string | null
  design_idea: string
  design_direction: string
  story: string
  fact_note: string | null
  interpretation_note: string
  image_url: string | null
  created_at: string
}

function DesignPageInner() {
  const { user, profile } = useAuth()
  const { ask } = useAI()
  const { t } = useLanguage()
  const [craftType, setCraftType] = useState(CRAFT_TYPES[0].value)
  const [theme, setTheme] = useState<typeof THEMES[number]['id']>('nature')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<DesignResult | null>(null)
  const [imageUrl, setImageUrl] = useState('')
  const [imagePrompt, setImagePrompt] = useState('')
  const [imageState, setImageState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')
  const [imageFailReason, setImageFailReason] = useState('')
  const [refineNote, setRefineNote] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [ideas, setIdeas] = useState<SavedIdea[] | null>(null)
  const [selectedIdea, setSelectedIdea] = useState<SavedIdea | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SavedIdea | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteToast, setDeleteToast] = useState(false)
  // Guards against double-saving the same generation (a retried request, a
  // repeated API response, or the user hammering "Generate" twice). Each
  // generation gets one save attempt, tracked by identity, not by state
  // (state updates are async and would let a second click sneak through).
  const savingGenerationRef = useRef<DesignResult | null>(null)

  useEffect(() => {
    if (profile?.craft_type && CRAFT_TYPES.some((c) => c.value === profile.craft_type)) setCraftType(profile.craft_type)
  }, [profile])

  useEffect(() => {
    if (!supabase || !user) return
    loadIdeas()
  }, [user])

  function loadIdeas() {
    if (!supabase || !user) return
    supabase.from('design_ideas').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).then(({ data }) => setIdeas(data ?? []))
  }

  async function handleGenerate() {
    setError('')
    setResult(null)
    setImageUrl('')
    setImagePrompt('')
    setImageState('idle')
    setImageFailReason('')
    setSaveState('idle')
    setLoading(true)

    try {
      const { data: sessionData } = await supabase?.auth.getSession() ?? { data: { session: null } }
      const accessToken = sessionData.session?.access_token

      // The generation prompt stays in English, since it's an instruction to the AI, not UI text.
      // refineNote (from the post-generation "want something different?" feedback
      // field) is folded into the same notes channel the image route already reads,
      // rather than adding a second param it would need to know about too.
      const combinedNotes = [notes.trim(), refineNote.trim()].filter(Boolean).join(', ')
      const themeLabel = THEMES.find((th) => th.id === theme)?.labelKey
      const [textRes, imageRes] = await Promise.all([
        ask(
          `Craft: ${craftType}. Inspiration theme: ${themeLabel ? t(themeLabel) : theme}.${combinedNotes ? ` Artisan's notes: ${combinedNotes}.` : ''}`,
          'design_inspiration'
        ),
        fetch('/api/design-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ craftType, theme, notes: combinedNotes }),
        }).then((r) => r.json()).catch((err) => ({ error: err?.message ?? 'Network error' })),
      ])

      if (!textRes) {
        setError(t('design.errorGenerate'))
        return
      }
      let parsedResult: DesignResult
      try {
        const cleaned = textRes.replace(/^```json\s*|```\s*$/g, '').trim()
        parsedResult = JSON.parse(cleaned)
        setResult(parsedResult)
      } catch {
        setError(t('design.errorUnexpected'))
        return
      }

      let generatedImageUrl = ''
      if (imageRes?.imageDataUrl) {
        generatedImageUrl = imageRes.imageDataUrl
        setImageUrl(generatedImageUrl)
        setImagePrompt(imageRes.prompt ?? '')
        setImageState('ready')
      } else {
        // A genuine failure after the API route's own retry, not a transient
        // blip we should silently paper over, but also not fatal: the idea
        // itself still generated fine and is worth keeping.
        if (imageRes?.error) console.warn('Design image unavailable:', imageRes.error)
        // Show the API's own reason when it gave one (e.g. quota exhausted)
        // rather than always falling back to the generic "unavailable" copy
        // that implies retrying might help when it sometimes provably won't.
        setImageFailReason(typeof imageRes?.error === 'string' ? imageRes.error : '')
        setImageState('failed')
      }

      // Auto-save immediately: the artisan shouldn't have to remember to
      // click Save for the idea to survive a refresh or a navigation away.
      await autoSaveIdea(parsedResult, generatedImageUrl, craftType, theme, combinedNotes)
    } catch {
      setError(t('common.aiUnavailable'))
    } finally {
      setLoading(false)
    }
  }

  async function autoSaveIdea(
    designResult: DesignResult,
    generatedImageUrl: string,
    savedCraftType: string,
    savedTheme: string,
    savedNotes: string
  ) {
    if (!user || !supabase) return
    if (savingGenerationRef.current === designResult) return // already saving/saved this exact generation
    savingGenerationRef.current = designResult
    setSaveState('saving')

    let storedImageUrl: string | null = null
    if (generatedImageUrl) {
      try {
        const blob = await (await fetch(generatedImageUrl)).blob()
        const path = `${user.id}/${Date.now()}.png`
        const { error: uploadError } = await supabase.storage.from('design-images').upload(path, blob, { contentType: 'image/png' })
        if (!uploadError) storedImageUrl = supabase.storage.from('design-images').getPublicUrl(path).data.publicUrl
      } catch (err) {
        console.error('Design image upload failed:', err)
      }
    }

    const { error: insertError } = await supabase.from('design_ideas').insert({
      user_id: user.id,
      craft_type: savedCraftType,
      theme: savedTheme,
      notes: savedNotes || null,
      design_idea: designResult.designIdea,
      design_direction: designResult.designDirection,
      story: designResult.story,
      fact_note: designResult.factNote,
      interpretation_note: designResult.interpretationNote,
      image_url: storedImageUrl,
    })

    if (insertError) {
      console.error('Auto-save failed:', insertError.message)
      setSaveState('error')
      return
    }
    setSaveState('saved')
    loadIdeas()
  }

  async function handleRetrySave() {
    if (!result) return
    savingGenerationRef.current = null
    const combinedNotes = [notes.trim(), refineNote.trim()].filter(Boolean).join(', ')
    await autoSaveIdea(result, imageUrl, craftType, theme, combinedNotes)
  }

  function confirmDelete() {
    if (!deleteTarget || !supabase) return
    const target = deleteTarget
    supabase.from('design_ideas').delete().eq('id', target.id).then(({ error: delError }) => {
      if (delError) {
        setDeleteError(t('design.deleteFailed'))
        return
      }
      setIdeas((prev) => (prev ?? []).filter((i) => i.id !== target.id))
      if (selectedIdea?.id === target.id) setSelectedIdea(null)
      setDeleteTarget(null)
      setDeleteError('')
      setDeleteToast(true)
      setTimeout(() => setDeleteToast(false), 2500)
      removeFromStorage('design-images', [target.image_url])
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1.15 }}>🎨</span>
        <div>
          <h1 style={pageTitleStyle}>{t('design.title')}</h1>
          <p style={pageSubtitleStyle}>{t('design.subtitle')}</p>
        </div>
      </div>
      <div className="ks-frieze" style={{ marginBottom: 28 }} />

      <p id="design-craft-heading" style={sectionLabel}>{t('design.yourCraft')}</p>
      <div role="group" aria-labelledby="design-craft-heading" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {CRAFT_TYPES.map((c) => (
          <button key={c.value} type="button" onClick={() => setCraftType(c.value)} aria-pressed={craftType === c.value} style={{
            background: craftType === c.value ? 'var(--ks-indigo)' : 'var(--ks-ivory)',
            color: craftType === c.value ? '#fff' : 'var(--ks-earth)',
            border: `1px solid ${craftType === c.value ? 'var(--ks-indigo)' : 'var(--ks-border)'}`,
            borderRadius: 20, padding: '8px 15px', fontSize: 12.5, fontFamily: 'var(--font-body)',
          }}>
            {t(c.key)}
          </button>
        ))}
      </div>

      <p id="design-theme-heading" style={sectionLabel}>{t('design.inspirationTheme')}</p>
      <div role="group" aria-labelledby="design-theme-heading" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginBottom: 24 }}>
        {THEMES.map((th) => (
          <button key={th.id} type="button" onClick={() => setTheme(th.id)} aria-pressed={theme === th.id} style={{
            background: theme === th.id ? 'var(--ks-indigo)' : 'var(--ks-ivory)',
            color: theme === th.id ? '#fff' : 'var(--ks-earth)',
            border: `1px solid ${theme === th.id ? 'var(--ks-indigo)' : 'var(--ks-border)'}`,
            borderRadius: 12, padding: '14px 8px', fontSize: 12.5, fontWeight: 500,
            fontFamily: 'var(--font-body)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }} aria-hidden="true">{th.emoji}</div>
            {t(th.labelKey)}
          </button>
        ))}
      </div>

      <label htmlFor="design-notes" style={{ ...sectionLabel, display: 'block' }}>{t('design.specificInMind')}</label>
      <textarea
        id="design-notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('design.specificPlaceholder')}
        rows={3}
        style={{
          width: '100%', background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 8,
          padding: '11px 12px', fontSize: 13.5, fontFamily: 'var(--font-body)', color: 'var(--ks-earth)',
          marginBottom: 24, resize: 'vertical',
        }}
      />

      <button type="button" onClick={handleGenerate} disabled={loading} style={{ ...primaryButtonStyle, marginBottom: 24, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}>
        {loading && <span className="ks-spinner" aria-hidden="true" />}
        {loading ? t('design.designing') : t('design.generateIdea')}
      </button>

      {error && (
        <div role="alert" style={{ ...errorBannerStyle, marginBottom: 24 }}>
          <span aria-hidden="true" style={{ fontSize: 16 }}>⚠️</span>
          <p style={{ fontSize: 13, color: 'var(--ks-earth)', lineHeight: 1.55 }}>{error}</p>
        </div>
      )}

      {loading && !result && (
        <section style={{ ...cardStyle, marginBottom: 32 }} aria-live="polite" aria-busy="true">
          <div className="ks-img-skeleton" style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 10, marginBottom: 18 }} />
          <div className="ks-img-skeleton" style={{ width: '70%', height: 14, borderRadius: 4, marginBottom: 10 }} />
          <div className="ks-img-skeleton" style={{ width: '100%', height: 12, borderRadius: 4, marginBottom: 6 }} />
          <div className="ks-img-skeleton" style={{ width: '90%', height: 12, borderRadius: 4 }} />
        </section>
      )}

      {result && (
        <section className="ks-pop-in" style={{ ...cardStyle, marginBottom: 32 }} aria-label={t('design.designIdea')}>
          {imageState === 'failed' && (
            <p style={{ fontSize: 11.5, color: 'var(--ks-muted)', marginBottom: 14 }}>
              {imageFailReason || t('design.imageUnavailable')}
            </p>
          )}
          {imageState === 'ready' && imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={t('design.designIdea')} style={{ width: '100%', borderRadius: 10, marginBottom: 18 }} />
          )}

          <p style={cardLabel}>{t('design.designIdea')}</p>
          <p style={bodyText}>{result.designIdea}</p>

          <p style={cardLabel}>{t('design.designDirection')}</p>
          <p style={bodyText}>{result.designDirection}</p>

          <p style={cardLabel}>{t('design.story')}</p>
          <p style={{ ...bodyText, fontStyle: 'italic' }}>{result.story}</p>

          {result.factNote && (
            <div style={{ background: 'rgba(15,91,78,0.08)', border: '1px solid rgba(15,91,78,0.25)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ks-jade)', marginBottom: 4 }}>✓ {t('design.verifiedContext').toUpperCase()}</p>
              <p style={{ fontSize: 12.5, color: 'var(--ks-earth)', lineHeight: 1.6 }}>{result.factNote}</p>
            </div>
          )}
          <div style={{ background: 'rgba(212,160,23,0.14)', border: '1px solid rgba(212,160,23,0.4)', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ks-turmeric)', marginBottom: 4 }}>✨ {t('design.aiInterpretation').toUpperCase()}</p>
            <p style={{ fontSize: 12.5, color: 'var(--ks-earth)', lineHeight: 1.6 }}>{result.interpretationNote}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
            <SaveStatusPill state={saveState} t={t} onRetry={handleRetrySave} />
            <button type="button" onClick={handleGenerate} disabled={loading} style={{ ...secondaryButtonStyle, opacity: loading ? 0.6 : 1, cursor: loading ? 'default' : 'pointer' }}>
              {t('design.tryAnother')}
            </button>
          </div>

          {imageUrl && (
            <GenerationFeedback
              key={imageUrl}
              kind="design"
              prompt={imagePrompt}
              refineNote={refineNote}
              onRefineNoteChange={setRefineNote}
            />
          )}
        </section>
      )}

      {ideas === null ? null : ideas.length > 0 && (
        <>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 16, color: 'var(--ks-earth)' }}>{t('design.myIdeas')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
            {ideas.map((idea) => {
              const ideaCraft = CRAFT_TYPES.find((c) => c.value === idea.craft_type)
              const ideaTheme = THEMES.find((th) => th.id === idea.theme)
              return (
                <div
                  key={idea.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedIdea(idea)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedIdea(idea) } }}
                  aria-label={`${t('design.viewIdea')}: ${idea.design_idea.slice(0, 60)}`}
                  className="ks-idea-card"
                  style={{
                    background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 12,
                    overflow: 'hidden', cursor: 'pointer', textAlign: 'left', minHeight: 44,
                  }}
                >
                  {idea.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={idea.image_url} alt="" style={{ width: '100%', height: 130, objectFit: 'cover', pointerEvents: 'none' }} />
                  )}
                  <div style={{ padding: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--ks-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 6 }}>
                      {ideaCraft ? t(ideaCraft.key) : idea.craft_type} · {ideaTheme ? t(ideaTheme.labelKey) : idea.theme}
                    </div>
                    <p style={{ fontSize: 12.5, color: 'var(--ks-earth)', lineHeight: 1.5 }}>
                      {idea.design_idea.slice(0, 110)}{idea.design_idea.length > 110 ? '…' : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {selectedIdea && (
        <IdeaDetailModal
          idea={selectedIdea}
          craftLabel={(() => { const c = CRAFT_TYPES.find((c) => c.value === selectedIdea.craft_type); return c ? t(c.key) : selectedIdea.craft_type })()}
          themeLabel={(() => { const th = THEMES.find((th) => th.id === selectedIdea.theme); return th ? t(th.labelKey) : selectedIdea.theme })()}
          t={t}
          onClose={() => setSelectedIdea(null)}
          onDelete={() => setDeleteTarget(selectedIdea)}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          title={t('design.deleteTitle')}
          warning={t('design.deleteWarning')}
          error={deleteError}
          onCancel={() => { setDeleteTarget(null); setDeleteError('') }}
          onConfirm={confirmDelete}
        />
      )}

      {deleteToast && (
        <div role="status" style={toastStyle}>{t('design.deletedToast')}</div>
      )}

      <style jsx>{`
        @keyframes ks-spin { to { transform: rotate(360deg); } }
        .ks-spinner {
          width: 14px; height: 14px; border-radius: 50%; display: inline-block;
          border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
          animation: ks-spin 0.7s linear infinite; vertical-align: -2px; margin-right: 8px;
        }
        @keyframes ks-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .ks-img-skeleton {
          background: linear-gradient(90deg, var(--ks-linen) 25%, var(--ks-border) 50%, var(--ks-linen) 75%);
          background-size: 800px 100%;
          animation: ks-shimmer 1.4s linear infinite;
        }
        .ks-idea-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .ks-idea-card:active {
          transform: scale(0.98);
        }
        @media (hover: hover) {
          .ks-idea-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(19,42,69,0.12);
          }
        }
        .ks-idea-card:focus-visible {
          outline: 2px solid var(--ks-turmeric);
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .ks-spinner, .ks-img-skeleton, .ks-idea-card { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  )
}

function SaveStatusPill({ state, t, onRetry }: { state: 'idle' | 'saving' | 'saved' | 'error'; t: (k: TranslationKey) => string; onRetry: () => void }) {
  if (state === 'idle') return null
  if (state === 'saving') {
    return <span style={{ fontSize: 12, color: 'var(--ks-muted)', fontWeight: 600 }}>{t('design.saving')}</span>
  }
  if (state === 'saved') {
    return <span style={{ fontSize: 12, color: 'var(--ks-jade)', fontWeight: 700 }}>✓ {t('design.saved')}</span>
  }
  return (
    <button type="button" onClick={onRetry} style={{ background: 'none', border: 'none', color: 'var(--ks-clay)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
      ⚠ {t('design.saveFailed')}
    </button>
  )
}

function IdeaDetailModal({
  idea, craftLabel, themeLabel, t, onClose, onDelete,
}: {
  idea: SavedIdea
  craftLabel: string
  themeLabel: string
  t: (k: TranslationKey) => string
  onClose: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(19,42,69,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 16px', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%',
          padding: 22, margin: 'auto 0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ks-indigo)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            ← {t('design.backToIdeas')}
          </button>
          <button type="button" onClick={onDelete} aria-label={t('products.delete')} style={{ background: 'none', border: 'none', color: 'var(--ks-clay)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
            {t('products.delete')}
          </button>
        </div>

        {idea.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={idea.image_url} alt={t('design.designIdea')} style={{ width: '100%', borderRadius: 10, marginBottom: 16 }} />
        )}

        <div style={{ fontSize: 11, color: 'var(--ks-muted)', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 12 }}>
          {craftLabel} · {themeLabel} · {new Date(idea.created_at).toLocaleString()}
        </div>

        {idea.notes && (
          <>
            <p style={cardLabel}>{t('design.specificInMind')}</p>
            <p style={{ ...bodyText, marginBottom: 14 }}>{idea.notes}</p>
          </>
        )}

        <p style={cardLabel}>{t('design.designIdea')}</p>
        <p style={bodyText}>{idea.design_idea}</p>

        <p style={cardLabel}>{t('design.designDirection')}</p>
        <p style={bodyText}>{idea.design_direction}</p>

        <p style={cardLabel}>{t('design.story')}</p>
        <p style={{ ...bodyText, fontStyle: 'italic' }}>{idea.story}</p>

        {idea.fact_note && (
          <div style={{ background: 'rgba(15,91,78,0.08)', border: '1px solid rgba(15,91,78,0.25)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ks-jade)', marginBottom: 4 }}>✓ {t('design.verifiedContext').toUpperCase()}</p>
            <p style={{ fontSize: 12.5, color: 'var(--ks-earth)', lineHeight: 1.6 }}>{idea.fact_note}</p>
          </div>
        )}
        <div style={{ background: 'rgba(212,160,23,0.14)', border: '1px solid rgba(212,160,23,0.4)', borderRadius: 10, padding: '12px 14px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ks-turmeric)', marginBottom: 4 }}>✨ {t('design.aiInterpretation').toUpperCase()}</p>
          <p style={{ fontSize: 12.5, color: 'var(--ks-earth)', lineHeight: 1.6 }}>{idea.interpretation_note}</p>
        </div>
      </div>
    </div>
  )
}


const toastStyle: React.CSSProperties = {
  position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', zIndex: 1200,
  background: 'var(--ks-earth)', color: '#fff', borderRadius: 10, padding: '10px 18px',
  fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
}

const pageTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ks-earth)', marginBottom: 4,
}

const pageSubtitleStyle: React.CSSProperties = {
  fontSize: 13.5, color: 'var(--ks-muted)', lineHeight: 1.55,
}

const sectionLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--ks-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12,
}

const cardLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--ks-clay)',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
}

const cardStyle: React.CSSProperties = {
  background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: 20,
}

const bodyText: React.CSSProperties = {
  fontSize: 14, lineHeight: 1.7, color: 'var(--ks-earth)', marginBottom: 16,
}

const primaryButtonStyle: React.CSSProperties = {
  background: 'var(--ks-indigo)', color: '#fff', border: 'none', borderRadius: 10,
  padding: '13px 24px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
  display: 'inline-flex', alignItems: 'center',
}

const secondaryButtonStyle: React.CSSProperties = {
  background: '#fff', color: 'var(--ks-earth)', border: '1px solid var(--ks-border)', borderRadius: 8,
  padding: '10px 18px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
}

const errorBannerStyle: React.CSSProperties = {
  background: 'rgba(196,85,45,0.08)', border: '1px solid rgba(196,85,45,0.3)',
  borderLeft: '3px solid var(--ks-clay)', borderRadius: 10, padding: '12px 16px',
  display: 'flex', gap: 10, alignItems: 'flex-start',
}

export default function DesignPage() {
  return (
    <RequireAuth>
      <DesignPageInner />
    </RequireAuth>
  )
}
