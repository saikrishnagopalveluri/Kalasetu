'use client'

import { useEffect, useId, useState } from 'react'
import { useAI } from '@/lib/useAI'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import RequireAuth from '@/components/RequireAuth'
import { LANGUAGES } from '@/lib/languages'
import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'

type Product = { id: string; name: string; material: string | null; craft_type: string | null; description: string | null }

const FORMATS: { id: string; emoji: string; labelKey: TranslationKey; mode: 'caption' | 'whatsapp' | 'facebook' }[] = [
  { id: 'caption', emoji: '📸', labelKey: 'promote.format.caption', mode: 'caption' },
  { id: 'whatsapp', emoji: '💬', labelKey: 'promote.format.whatsapp', mode: 'whatsapp' },
  { id: 'facebook', emoji: '📘', labelKey: 'promote.format.facebook', mode: 'facebook' },
]

const OCCASIONS: { id: string; labelKey: TranslationKey }[] = [
  { id: 'general', labelKey: 'promote.occasion.general' },
  { id: 'festival', labelKey: 'promote.occasion.festival' },
  { id: 'launch', labelKey: 'promote.occasion.launch' },
  { id: 'collection', labelKey: 'promote.occasion.collection' },
  { id: 'sale', labelKey: 'promote.occasion.sale' },
  { id: 'custom', labelKey: 'promote.occasion.custom' },
]

function PromotePageInner() {
  const { user } = useAuth()
  const { t, language: uiLanguage } = useLanguage()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [format, setFormat] = useState(FORMATS[0])
  const [occasion, setOccasion] = useState(OCCASIONS[0])
  const [language, setLanguage] = useState<typeof LANGUAGES[number]['id']>(uiLanguage)
  // See app/content/page.tsx for why this follows the site's own language
  // rather than always starting at English.
  useEffect(() => { setLanguage(uiLanguage) }, [uiLanguage])
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)

  const { ask, loading, error, clearError } = useAI()
  const productFieldId = useId()
  const occasionFieldId = useId()
  const languageFieldId = useId()

  useEffect(() => {
    if (!supabase || !user) return
    supabase.from('products').select('id, name, material, craft_type, description').eq('user_id', user.id)
      .order('created_at', { ascending: false }).then(({ data }) => {
        setProducts(data ?? [])
        if (data && data.length > 0) setSelectedId(data[0].id)
      })
  }, [user])

  const selectedProduct = products.find((p) => p.id === selectedId)

  async function handleGenerate() {
    if (!selectedProduct) return
    clearError()
    setCopied(false)

    // The generation prompt stays in English, as an instruction to the AI, not UI
    // text; the `language` param controls what language the content itself is written in.
    const occasionLine = occasion.id === 'general' ? '' : `\nOccasion: ${t(occasion.labelKey)}`
    const prompt = `Product: ${selectedProduct.name}${selectedProduct.material ? `\nMaterial: ${selectedProduct.material}` : ''}${selectedProduct.description ? `\nDescription: ${selectedProduct.description}` : ''}${occasionLine}\n\nWrite a ${t(format.labelKey).toLowerCase()} to promote this product.`
    const text = await ask(prompt, format.mode, language)
    if (text) {
      setResult(text)
      supabase?.from('generated_content').insert({
        user_id: user?.id, product_name: selectedProduct.name, content_type: format.id, language, content: text,
      }).then(() => {})
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (products.length === 0) {
    return (
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>{t('promote.title')}</h1>
        <div className="ks-frieze" style={{ margin: '16px 0 26px' }} />
        <div style={{ background: 'var(--ks-ivory)', border: '1px dashed var(--ks-border)', borderRadius: 12, padding: '28px 18px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--ks-muted)', lineHeight: 1.55 }}>
            {t('promote.noProducts')}{' '}
            <a href="/content" style={{ color: 'var(--ks-indigo)', fontWeight: 600 }}>{t('promote.createFirst')}</a>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('promote.title')}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ks-muted)', lineHeight: 1.55, marginBottom: 16, maxWidth: 520 }}>
        {t('promote.subtitle')}
      </p>
      <div className="ks-frieze" style={{ marginBottom: 26 }} />

      <div style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: 20, marginBottom: 22 }}>
        <label htmlFor={productFieldId} style={labelStyle}>{t('promote.product')}</label>
        <select id={productFieldId} value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setResult('') }} style={inputStyle}>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <p style={sectionLabel}>{t('promote.format')}</p>
      <div role="group" aria-label={t('promote.format')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        {FORMATS.map((f) => (
          <ChipButton key={f.id} active={format.id === f.id} onClick={() => { setFormat(f); setResult('') }}>
            <span aria-hidden="true" style={{ marginRight: 6 }}>{f.emoji}</span>{t(f.labelKey)}
          </ChipButton>
        ))}
      </div>

      <p style={sectionLabel}>{t('promote.occasion')}</p>
      <label htmlFor={occasionFieldId} className="ks-sr-only">{t('promote.occasion')}</label>
      <select id={occasionFieldId} value={occasion.id} onChange={(e) => setOccasion(OCCASIONS.find((o) => o.id === e.target.value)!)} style={{ ...inputStyle, marginBottom: 22, width: 'auto', minWidth: 220 }}>
        {OCCASIONS.map((o) => <option key={o.id} value={o.id}>{t(o.labelKey)}</option>)}
      </select>

      <p style={sectionLabel}>{t('promote.language')}</p>
      <label htmlFor={languageFieldId} className="ks-sr-only">{t('promote.language')}</label>
      <select id={languageFieldId} value={language} onChange={(e) => setLanguage(e.target.value as typeof language)} style={{ ...inputStyle, marginBottom: 24, width: 'auto', minWidth: 200 }}>
        {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label} ({l.name})</option>)}
      </select>

      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          background: 'var(--ks-indigo)', color: '#fff', border: 'none', borderRadius: 10,
          padding: '14px 26px', fontSize: 14.5, fontWeight: 600, fontFamily: 'var(--font-body)',
          cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1, marginBottom: 24,
          minHeight: 46, width: '100%',
        }}
      >
        {loading ? t('promote.writing') : t('promote.generate')}
      </button>

      {error && (
        <div role="alert" style={{ background: 'rgba(196,85,45,0.1)', color: 'var(--ks-clay)', borderLeft: '3px solid var(--ks-clay)', borderRadius: 10, padding: '12px 16px', fontSize: 13.5, lineHeight: 1.5, marginBottom: 22 }}>
          {error}
        </div>
      )}

      {result && (
        <div className="ks-pop-in" style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: 20 }}>
          <p style={{ ...sectionLabel, marginBottom: 12 }}>{t('promote.your')} {t(format.labelKey).toLowerCase()}</p>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ks-earth)', whiteSpace: 'pre-wrap', marginBottom: 18 }}>{result}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={handleCopy} style={secondaryButtonStyle}>{copied ? t('common.copied') : t('common.copy')}</button>
            <button onClick={handleGenerate} disabled={loading} style={secondaryButtonStyle}>{t('common.tryAgain')}</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .ks-sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 12.5, fontWeight: 600, color: 'var(--ks-muted)',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12,
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ks-muted)', marginBottom: 8,
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 8,
  padding: '11px 12px', fontSize: 16, fontFamily: 'var(--font-body)', color: 'var(--ks-earth)', marginBottom: 16,
}
const secondaryButtonStyle: React.CSSProperties = {
  background: '#fff', color: 'var(--ks-earth)', border: '1px solid var(--ks-border)', borderRadius: 8,
  padding: '11px 18px', fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 44,
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} style={{
      background: active ? 'var(--ks-indigo)' : 'var(--ks-ivory)',
      color: active ? '#fff' : 'var(--ks-earth)',
      border: `1px solid ${active ? 'var(--ks-indigo)' : 'var(--ks-border)'}`,
      borderRadius: 999, padding: '9px 17px', fontSize: 13.5, fontWeight: 500,
      fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 40,
    }}>
      {children}
    </button>
  )
}

export default function PromotePage() {
  return (
    <RequireAuth>
      <PromotePageInner />
    </RequireAuth>
  )
}
