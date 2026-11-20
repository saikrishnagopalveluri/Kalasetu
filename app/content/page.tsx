'use client'

import { useEffect, useState } from 'react'
import { IconContent } from '@/components/CraftIcons'
import { useFollowingState } from '@/lib/useFollowingState'
import { useAI } from '@/lib/useAI'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import RequireAuth from '@/components/RequireAuth'
import { LANGUAGES } from '@/lib/languages'
import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'

type Product = {
  id: string
  name: string
  material: string | null
  craft_type: string | null
  description: string | null
  craft_story: string | null
}

const CONTENT_TYPES: { id: string; emoji: string; labelKey: TranslationKey; mode: 'description' | 'craft_story'; field: 'description' | 'craft_story' }[] = [
  { id: 'description', emoji: '📝', labelKey: 'content.type.description', mode: 'description', field: 'description' },
  { id: 'craft_story', emoji: '📜', labelKey: 'content.type.craftStory', mode: 'craft_story', field: 'craft_story' },
]

function ContentPageInner() {
  const { user } = useAuth()
  const { t, language: uiLanguage } = useLanguage()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [newName, setNewName] = useState('')
  const [newMaterial, setNewMaterial] = useState('')
  const [contentType, setContentType] = useState<typeof CONTENT_TYPES[number]>(CONTENT_TYPES[0])
  const [language, setLanguage] = useFollowingState<typeof LANGUAGES[number]['id']>(uiLanguage)
  // Defaults to the site's own language rather than always English, and
  // follows it if the reader switches languages elsewhere on the site —
  // matches the same fix already applied to the blog reading experience.
  // A manual choice made right here still works exactly as before; it just
  // starts from the language the reader is already using instead of forcing
  // them to re-select it every time on this one tool.
  const [result, setResult] = useState('')
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [creating, setCreating] = useState(false)
  const [validationError, setValidationError] = useState('')

  const { ask, loading, error, clearError } = useAI()

  useEffect(() => { if (user) loadProducts() }, [user])

  async function loadProducts() {
    if (!supabase || !user) return
    const { data } = await supabase
      .from('products')
      .select('id, name, material, craft_type, description, craft_story')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setProducts(data ?? [])
    if (!selectedId && data && data.length > 0) setSelectedId(data[0].id)
  }

  async function handleCreateProduct() {
    if (!newName.trim()) { setValidationError(t('products.nameRequired')); return }
    setValidationError('')
    setCreating(true)
    const { data } = await supabase!.from('products').insert({
      user_id: user?.id, name: newName, material: newMaterial || null,
    }).select('id, name, material, craft_type, description, craft_story').single()
    setNewName(''); setNewMaterial('')
    await loadProducts()
    if (data) setSelectedId(data.id)
    setCreating(false)
  }

  const selectedProduct = products.find((p) => p.id === selectedId)

  async function handleGenerate() {
    if (!selectedProduct) { setValidationError(t('content.pickProductFirst')); return }
    setValidationError('')
    clearError()
    setSaved(false)

    // The generation prompt itself stays in English, since it's an instruction to the
    // AI, not UI text, and the `language` param already tells it what language
    // to write the actual content in.
    const contentTypeLabel = contentType.field === 'description' ? 'product description' : 'craft story'
    const prompt = `Product: ${selectedProduct.name}${selectedProduct.material ? `\nMaterial: ${selectedProduct.material}` : ''}${selectedProduct.craft_type ? `\nCraft: ${selectedProduct.craft_type}` : ''}\n\nWrite a ${contentTypeLabel} for this product.`
    const text = await ask(prompt, contentType.mode, language)
    if (text) setResult(text)
  }

  async function handleSave() {
    if (!selectedProduct || !result) return
    setSaveError('')
    const { data, error: saveErr } = await supabase!
      .from('products')
      .update({ [contentType.field]: result })
      .eq('id', selectedProduct.id)
      .select('id')
    if (saveErr) {
      console.error('Failed to save content to product:', saveErr.message)
      setSaveError(t('content.saveFailed'))
      return
    }
    if (!data || data.length === 0) {
      // Update silently affected 0 rows, most likely an RLS policy gap.
      setSaveError(t('content.saveNoEffect'))
      return
    }
    setSaved(true)
    loadProducts()
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(196,85,45,0.1)', color: 'var(--ks-clay)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><IconContent size={22} /></span>
        <div>
          <h1 style={pageTitleStyle}>{t('content.title')}</h1>
          <p style={pageSubtitleStyle}>{t('content.subtitle')}</p>
        </div>
      </div>
      <div className="ks-frieze" style={{ marginBottom: 28 }} />

      {/* Product picker */}
      <section style={cardStyle}>
        <label htmlFor="content-product-select" style={fieldLabel}>{t('content.product')}</label>
        {products.length > 0 ? (
          <select
            id="content-product-select"
            value={selectedId}
            onChange={(e) => { setSelectedId(e.target.value); setResult(''); setSaved(false) }}
            style={{ ...inputStyle, marginBottom: 4 }}
          >
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--ks-muted)', marginBottom: 10 }}>{t('content.noProducts')}</p>
        )}

        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 12.5, color: 'var(--ks-indigo)', cursor: 'pointer', fontWeight: 600 }}>{t('content.addNewProduct')}</summary>
          <div style={{ marginTop: 12 }}>
            <label htmlFor="content-new-name" style={fieldLabel}>{t('products.productNamePlaceholder')}</label>
            <input id="content-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('products.productNamePlaceholder')} style={inputStyle} />
            <label htmlFor="content-new-material" style={fieldLabel}>{t('products.material')}</label>
            <input id="content-new-material" value={newMaterial} onChange={(e) => setNewMaterial(e.target.value)} placeholder={t('products.material')} style={{ ...inputStyle, marginBottom: 12 }} />
            <button type="button" onClick={handleCreateProduct} disabled={creating} style={{ ...secondaryButtonStyle, opacity: creating ? 0.7 : 1, cursor: creating ? 'default' : 'pointer' }}>
              {creating ? t('content.adding') : t('content.addProduct')}
            </button>
          </div>
        </details>
        {validationError && (
          <p role="alert" style={inlineErrorStyle}>
            <span aria-hidden="true" style={{ color: 'var(--ks-clay)' }}>⚠</span> {validationError}
          </p>
        )}
      </section>

      {selectedProduct?.description && contentType.id === 'description' && (
        <p style={{ fontSize: 11.5, color: 'var(--ks-muted)', marginBottom: 14, lineHeight: 1.5 }}>{t('content.alreadyHasDescription')}</p>
      )}

      {/* Content type */}
      <p id="content-type-heading" style={sectionLabel}>{t('content.whatDoYouNeed')}</p>
      <div role="group" aria-labelledby="content-type-heading" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {CONTENT_TYPES.map((ct) => (
          <ChipButton key={ct.id} active={contentType.id === ct.id} onClick={() => { setContentType(ct); setResult(''); setSaved(false) }}>
            <span style={{ marginRight: 6 }} aria-hidden="true">{ct.emoji}</span>{t(ct.labelKey)}
          </ChipButton>
        ))}
      </div>

      {/* Language */}
      <label htmlFor="content-language-select" style={{ ...sectionLabel, display: 'block' }}>{t('content.language')}</label>
      <select
        id="content-language-select"
        value={language}
        onChange={(e) => setLanguage(e.target.value as typeof language)}
        style={{ ...inputStyle, marginBottom: 24, width: 'auto', minWidth: 200 }}
      >
        {LANGUAGES.map((l) => (
          <option key={l.id} value={l.id}>{l.label} ({l.name})</option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || !selectedProduct}
        style={{
          ...primaryButtonStyle, marginBottom: 24,
          cursor: loading ? 'default' : 'pointer',
          opacity: loading || !selectedProduct ? 0.6 : 1,
        }}
      >
        {loading && <span className="ks-spinner" aria-hidden="true" />}
        {loading ? t('content.writing') : t('content.generate')}
      </button>

      {error && (
        <div role="alert" style={{ ...errorBannerStyle, marginBottom: 24 }}>
          <span aria-hidden="true" style={{ fontSize: 16 }}>⚠️</span>
          <p style={{ fontSize: 13, color: 'var(--ks-earth)', lineHeight: 1.55 }}>{error}</p>
        </div>
      )}

      {result && (
        <section className="ks-pop-in" style={cardStyle} aria-label={t(contentType.labelKey)}>
          <p style={{ ...sectionLabel, marginBottom: 12 }}>{t('content.your')} {t(contentType.labelKey).toLowerCase()}</p>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ks-earth)', whiteSpace: 'pre-wrap', marginBottom: 18 }}>
            {result}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={handleSave} style={{ ...secondaryButtonStyle, background: saved ? 'var(--ks-jade)' : 'var(--ks-indigo)', color: '#fff', border: 'none' }}>
              {saved ? t('content.savedToProduct') : `${t('content.saveTo')} ${selectedProduct?.name}`}
            </button>
            <button type="button" onClick={handleGenerate} disabled={loading} style={{ ...secondaryButtonStyle, opacity: loading ? 0.6 : 1, cursor: loading ? 'default' : 'pointer' }}>
              {t('common.tryAgain')}
            </button>
          </div>
          {saveError && (
            <p role="alert" style={{ ...inlineErrorStyle, marginTop: 12, marginBottom: 0 }}>
              <span aria-hidden="true" style={{ color: 'var(--ks-clay)' }}>⚠</span> {saveError}
            </p>
          )}
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

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--ks-muted)', marginBottom: 6,
}

const cardStyle: React.CSSProperties = {
  background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: 20, marginBottom: 24,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid var(--ks-border)',
  borderRadius: 8, padding: '11px 12px', fontSize: 14, fontFamily: 'var(--font-body)',
  color: 'var(--ks-earth)', marginBottom: 14,
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
  color: 'var(--ks-earth)', fontSize: 12, marginTop: 10, fontWeight: 500,
}

const errorBannerStyle: React.CSSProperties = {
  background: 'rgba(196,85,45,0.08)', border: '1px solid rgba(196,85,45,0.3)',
  borderLeft: '3px solid var(--ks-clay)', borderRadius: 10, padding: '12px 16px',
  display: 'flex', gap: 10, alignItems: 'flex-start',
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        background: active ? 'var(--ks-indigo)' : 'var(--ks-ivory)',
        color: active ? '#fff' : 'var(--ks-earth)',
        border: `1px solid ${active ? 'var(--ks-indigo)' : 'var(--ks-border)'}`,
        borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 500,
        fontFamily: 'var(--font-body)',
      }}
    >
      {children}
    </button>
  )
}

export default function ContentPage() {
  return (
    <RequireAuth>
      <ContentPageInner />
    </RequireAuth>
  )
}
