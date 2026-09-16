'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import { useLanguage } from '@/lib/LanguageProvider'

// Thumbs up/down under a freshly generated image, plus an optional "what
// would you change" note that the caller feeds into its next generate()
// call. Render with `key={resultUrl}` (or similar) from the parent so a new
// generation gets a fresh, unrated instance rather than carrying over the
// previous rating.
export default function GenerationFeedback({
  kind,
  prompt,
  refineNote,
  onRefineNoteChange,
}: {
  kind: 'photoshoot' | 'design'
  prompt?: string
  refineNote: string
  onRefineNoteChange: (value: string) => void
}) {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [rating, setRating] = useState<'up' | 'down' | null>(null)

  async function rate(value: 'up' | 'down') {
    setRating(value)
    if (!supabase || !user) return
    await supabase.from('generation_feedback').insert({
      user_id: user.id,
      kind,
      rating: value,
      prompt: prompt ?? null,
    })
  }

  return (
    <div style={{ borderTop: '1px solid var(--ks-border)', marginTop: 18, paddingTop: 16 }}>
      {rating === null ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--ks-muted)', fontWeight: 600 }}>{t('common.rate.question')}</span>
          <button type="button" onClick={() => rate('up')} aria-label={t('common.rate.helpful')} style={rateButtonStyle}>
            <span aria-hidden="true">👍</span>
          </button>
          <button type="button" onClick={() => rate('down')} aria-label={t('common.rate.notHelpful')} style={rateButtonStyle}>
            <span aria-hidden="true">👎</span>
          </button>
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: 'var(--ks-earth)', marginBottom: rating === 'down' ? 10 : 0, lineHeight: 1.5 }}>
          {rating === 'up' ? <><span aria-hidden="true">🎉 </span>{t('common.rate.thanksUp')}</> : t('common.rate.thanksDown')}
        </p>
      )}

      {rating === 'down' && (
        <div>
          <label htmlFor={`refine-note-${kind}`} style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--ks-muted)', marginBottom: 6 }}>
            {t('common.refine.label')}
          </label>
          <textarea
            id={`refine-note-${kind}`}
            value={refineNote}
            onChange={(e) => onRefineNoteChange(e.target.value)}
            placeholder={t('common.refine.placeholder')}
            rows={2}
            style={{
              width: '100%', background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 8,
              padding: '9px 11px', fontSize: 13, fontFamily: 'var(--font-body)', color: 'var(--ks-earth)',
              resize: 'vertical',
            }}
          />
        </div>
      )}
    </div>
  )
}

const rateButtonStyle: React.CSSProperties = {
  background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 999,
  width: 38, height: 38, fontSize: 16, cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}
