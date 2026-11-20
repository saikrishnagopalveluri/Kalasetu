'use client'

import { useRef, useState } from 'react'
import RequireAuth from '@/components/RequireAuth'
import { extractDominantColor } from '@/lib/colorExtract'
import { useLanguage } from '@/lib/LanguageProvider'
import { supabase } from '@/lib/supabase'
import type { TranslationKey } from '@/lib/translations'
import GenerationFeedback from '@/components/GenerationFeedback'

const PRESETS: { id: string; emoji: string; key: TranslationKey }[] = [
  { id: 'studio', emoji: '📸', key: 'studio.preset.studio' },
  { id: 'heritage', emoji: '🪔', key: 'studio.preset.heritage' },
  { id: 'festival', emoji: '🎉', key: 'studio.preset.festival' },
  { id: 'story', emoji: '🌿', key: 'studio.preset.story' },
  { id: 'premium', emoji: '✨', key: 'studio.preset.premium' },
  { id: 'fashion', emoji: '👗', key: 'studio.preset.fashion' },
]

function StudioPageInner() {
  const { t } = useLanguage()
  const [productName, setProductName] = useState('')
  const [material, setMaterial] = useState('')
  const [preset, setPreset] = useState(PRESETS[0].id)
  const [refPreview, setRefPreview] = useState<string | null>(null)
  const [colorHint, setColorHint] = useState<string | null>(null)
  const [refImageDataUrl, setRefImageDataUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState('')
  const [resultPrompt, setResultPrompt] = useState('')
  const [refineNote, setRefineNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [validationError, setValidationError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      setRefPreview(dataUrl)
      setRefImageDataUrl(dataUrl)
      setColorHint(await extractDominantColor(dataUrl))
    }
    reader.readAsDataURL(file)
  }

  async function handleGenerate() {
    if (!productName.trim()) {
      setValidationError(t('studio.nameRequired'))
      return
    }
    setValidationError('')
    setError('')
    setLoading(true)
    setResultUrl('')

    try {
      const { data: sessionData } = await supabase?.auth.getSession() ?? { data: { session: null } }
      const accessToken = sessionData.session?.access_token
      const res = await fetch('/api/photoshoot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ productName, material, preset, colorHint, refineNote, refImageDataUrl }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Server messages are English; show the artisan's language instead.
        setError(t(res.status === 429 ? 'common.tooManyRequests' : res.status === 400 ? 'common.somethingWrong' : 'common.aiUnavailable'))
        return
      }
      setResultUrl(data.imageDataUrl)
      setResultPrompt(data.prompt ?? '')
    } catch {
      setError(t('common.aiUnavailable'))
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `${productName.replace(/\s+/g, '-').toLowerCase() || 'photoshoot'}.png`
    a.click()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1.15 }}>📸</span>
        <div>
          <h1 style={pageTitleStyle}>{t('studio.title')}</h1>
          <p style={pageSubtitleStyle}>{t('studio.subtitle')}</p>
        </div>
      </div>
      <div className="ks-frieze" style={{ marginBottom: 28 }} />

      {/* Reference photo (optional), sent to the image model as a real
          reference so the generated shot follows the product's actual shape
          and colours, not just a text description of it. */}
      <section style={{ ...cardStyle, borderStyle: 'dashed', textAlign: 'center' }} aria-labelledby="studio-ref-heading">
        <p id="studio-ref-heading" style={sectionLabel}>{t('studio.addProductPhoto')}</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          aria-label={t('studio.addProductPhoto')}
          style={{ display: 'none' }}
        />
        {refPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={refPreview} alt={t('studio.productName')} style={{ maxWidth: 160, maxHeight: 160, borderRadius: 10, marginBottom: 12, boxShadow: '0 2px 8px rgba(19,42,69,0.12)' }} />
        ) : (
          <div style={{ fontSize: 34, marginBottom: 10 }} aria-hidden="true">🖼️</div>
        )}
        <div>
          <button type="button" onClick={() => fileRef.current?.click()} style={secondaryButtonStyle}>
            {refPreview ? t('studio.changePhoto') : t('studio.addProductPhoto')}
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--ks-muted)', marginTop: 10, lineHeight: 1.5 }}>
          {t('studio.refHint')}
          {colorHint && ' ' + t('studio.colorHint').replace('{color}', colorHint)}
        </p>
      </section>

      {/* Product info */}
      <section style={cardStyle}>
        <label htmlFor="studio-product-name" style={fieldLabel}>{t('studio.productName')}</label>
        <input
          id="studio-product-name"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          placeholder={t('studio.productNamePlaceholder')}
          aria-required="true"
          aria-invalid={!!validationError}
          style={{ ...inputStyle, marginBottom: validationError ? 6 : 16 }}
        />
        {validationError && (
          <p role="alert" style={inlineErrorStyle}>
            <span aria-hidden="true" style={{ color: 'var(--ks-clay)' }}>⚠</span> {validationError}
          </p>
        )}
        <label htmlFor="studio-material" style={fieldLabel}>{t('studio.material')}</label>
        <input
          id="studio-material"
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          placeholder={t('studio.materialPlaceholder')}
          style={inputStyle}
        />
      </section>

      {/* Preset */}
      <p id="studio-style-heading" style={sectionLabel}>{t('studio.chooseStyle')}</p>
      <div role="group" aria-labelledby="studio-style-heading" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10, marginBottom: 28 }}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            aria-pressed={preset === p.id}
            style={{
              background: preset === p.id ? 'var(--ks-indigo)' : 'var(--ks-ivory)',
              color: preset === p.id ? '#fff' : 'var(--ks-earth)',
              border: `1px solid ${preset === p.id ? 'var(--ks-indigo)' : 'var(--ks-border)'}`,
              borderRadius: 12, padding: '14px 8px', fontSize: 12.5, fontWeight: 500,
              fontFamily: 'var(--font-body)', textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 4 }} aria-hidden="true">{p.emoji}</div>
            {t(p.key)}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        style={{ ...primaryButtonStyle, marginBottom: 28, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1 }}
      >
        {loading && <span className="ks-spinner" aria-hidden="true" />}
        {loading ? t('studio.creatingPhoto') : t('studio.createPhoto')}
      </button>

      {error && (
        <div role="alert" style={{ ...errorBannerStyle, marginBottom: 28 }}>
          <span aria-hidden="true" style={{ fontSize: 16 }}>⚠️</span>
          <p style={{ fontSize: 13, color: 'var(--ks-earth)', lineHeight: 1.55 }}>{error}</p>
        </div>
      )}

      {resultUrl && (
        <section className="ks-pop-in" style={cardStyle} aria-label={t('studio.createPhoto')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resultUrl} alt={productName || t('studio.productName')} style={{ width: '100%', borderRadius: 10, marginBottom: 14 }} />
          <p style={{ fontSize: 11.5, color: 'var(--ks-muted)', marginBottom: 16, lineHeight: 1.55 }}>
            {t('studio.aiPreviewNote')}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={handleDownload} style={secondaryButtonStyle}>{t('common.download')}</button>
            <button type="button" onClick={handleGenerate} disabled={loading} style={{ ...secondaryButtonStyle, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>{t('common.tryAgain')}</button>
          </div>

          <GenerationFeedback
            key={resultUrl}
            kind="photoshoot"
            prompt={resultPrompt}
            refineNote={refineNote}
            onRefineNoteChange={setRefineNote}
          />
        </section>
      )}

      <style jsx>{`
        @keyframes ks-spin { to { transform: rotate(360deg); } }
        .ks-spinner {
          width: 14px; height: 14px; border-radius: 50%; display: inline-block;
          border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
          animation: ks-spin 0.7s linear infinite; vertical-align: -2px; margin-right: 8px;
        }
        @media (prefers-reduced-motion: reduce) {
          .ks-spinner { animation: none; }
        }
      `}</style>
    </div>
  )
}

export default function StudioPage() {
  return (
    <RequireAuth>
      <StudioPageInner />
    </RequireAuth>
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
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12,
}

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--ks-muted)', marginBottom: 6,
}

const cardStyle: React.CSSProperties = {
  background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)',
  borderRadius: 14, padding: 20, marginBottom: 24,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid var(--ks-border)',
  borderRadius: 8, padding: '11px 12px', fontSize: 14, fontFamily: 'var(--font-body)',
  color: 'var(--ks-earth)',
}

const primaryButtonStyle: React.CSSProperties = {
  background: 'var(--ks-indigo)', color: '#fff', border: 'none',
  borderRadius: 10, padding: '13px 24px', fontSize: 14, fontWeight: 600,
  fontFamily: 'var(--font-body)', display: 'inline-flex', alignItems: 'center',
}

const secondaryButtonStyle: React.CSSProperties = {
  background: '#fff', color: 'var(--ks-earth)', border: '1px solid var(--ks-border)',
  borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600,
  fontFamily: 'var(--font-body)',
}

const inlineErrorStyle: React.CSSProperties = {
  color: 'var(--ks-earth)', fontSize: 12, marginBottom: 14, fontWeight: 500,
}

const errorBannerStyle: React.CSSProperties = {
  background: 'rgba(196,85,45,0.08)', border: '1px solid rgba(196,85,45,0.3)',
  borderLeft: '3px solid var(--ks-clay)', borderRadius: 10, padding: '12px 16px',
  display: 'flex', gap: 10, alignItems: 'flex-start',
}
