'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import RequireAuth from '@/components/RequireAuth'
import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'
import DeleteConfirmModal from '@/components/DeleteConfirmModal'
import { removeFromStorage } from '@/lib/storageCleanup'
import { advanceReferral } from '@/lib/referrals'

type Product = {
  id: string
  name: string
  material: string | null
  craft_type: string | null
  image_url: string | null
  created_at: string
}

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

function ProductsPageInner() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [products, setProducts] = useState<Product[] | null>(null)
  const [name, setName] = useState('')
  const [material, setMaterial] = useState('')
  const [craftType, setCraftType] = useState(CRAFT_TYPES[0].value)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) loadProducts()
  }, [user])

  async function loadProducts() {
    if (!supabase || !user) return
    const { data } = await supabase
      .from('products')
      .select('id, name, material, craft_type, image_url, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setProducts(data ?? [])
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setImageFiles(files)
    Promise.all(files.map((file) => new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsDataURL(file)
    }))).then(setImagePreviews)
  }

  function resetForm() {
    setEditingId(null)
    setExistingImageUrl(null)
    setName('')
    setMaterial('')
    setCraftType(CRAFT_TYPES[0].value)
    setImageFiles([])
    setImagePreviews([])
    setValidationError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function startEdit(p: Product) {
    setEditingId(p.id)
    setExistingImageUrl(p.image_url)
    setName(p.name)
    setMaterial(p.material ?? '')
    setCraftType(p.craft_type ?? CRAFT_TYPES[0].value)
    setImageFiles([])
    setImagePreviews(p.image_url ? [p.image_url] : [])
    setValidationError('')
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleAdd() {
    if (!name.trim()) {
      setValidationError(t('products.nameRequired'))
      return
    }
    setValidationError('')
    setSaving(true)

    // First uploaded photo becomes the cover (products.image_url, used
    // everywhere else in the app already); any additional photos go into
    // product_images as the gallery shown on the product's own page.
    let imageUrl: string | null = editingId ? existingImageUrl : null
    const galleryUrls: string[] = []
    if (imageFiles.length > 0 && supabase && user) {
      for (const file of imageFiles) {
        const ext = file.name.split('.').pop()
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file)
        if (!uploadError) {
          const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
          if (imageUrl === null) imageUrl = url
          else galleryUrls.push(url)
        } else {
          console.error('Image upload failed:', uploadError.message)
        }
      }
    }

    let productId = editingId
    if (editingId) {
      await supabase?.from('products').update({
        name, material: material || null, craft_type: craftType, image_url: imageUrl,
      }).eq('id', editingId)
    } else {
      const { data: inserted } = await supabase!.from('products').insert({
        user_id: user?.id, name, material: material || null, craft_type: craftType, image_url: imageUrl,
      }).select('id').single()
      productId = inserted?.id ?? null
      // Server-side no-ops after the first call, so it's safe to call on
      // every new product rather than tracking "was this really the first".
      if (productId) advanceReferral('FIRST_PRODUCT_COMPLETED')
    }

    if (productId && galleryUrls.length > 0) {
      await supabase?.from('product_images').insert(
        galleryUrls.map((image_url, i) => ({ product_id: productId, image_url, position: i }))
      )
    }
    resetForm()
    await loadProducts()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const product = products?.find((p) => p.id === id)
    const { data: gallery } = await supabase!.from('product_images').select('image_url').eq('product_id', id)
    await supabase?.from('products').delete().eq('id', id)
    await removeFromStorage('product-images', [product?.image_url, ...(gallery ?? []).map((g) => g.image_url)])
    if (editingId === id) resetForm()
    await loadProducts()
  }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('products.title')}
      </h1>
      <p style={{ fontSize: 14, color: 'var(--ks-muted)', lineHeight: 1.55, marginBottom: 16, maxWidth: 520 }}>
        {t('products.subtitle')}
      </p>
      <div className="ks-frieze" style={{ marginBottom: 26 }} />

      <a
        href="/catalogue"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 9, marginBottom: 22,
          background: 'var(--ks-turmeric)', color: 'var(--ks-earth)', textDecoration: 'none',
          borderRadius: 10, padding: '12px 20px', fontSize: 14, fontWeight: 700,
          minHeight: 44, boxShadow: '0 2px 6px rgba(19,42,69,0.12)',
        }}
      >
        <span aria-hidden="true">📋</span> {t('products.makeCatalogue')}
      </a>

      {!supabaseConfigured && (
        <div style={{
          background: 'rgba(212,160,23,0.15)', color: 'var(--ks-earth)', borderLeft: '3px solid var(--ks-turmeric)',
          borderRadius: 10, padding: '12px 16px', fontSize: 13.5, lineHeight: 1.5, marginBottom: 22,
        }}>
          {t('products.notConnected')}
        </div>
      )}

      {/* Add / edit product form */}
      <div ref={formRef} style={{
        background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)',
        borderRadius: 14, padding: 20, marginBottom: 28,
      }}>
        {editingId && (
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ks-clay)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 14 }}>
            {t('products.editProduct')}
          </p>
        )}
        <label htmlFor="product-photo-btn" style={labelStyle}>{t('products.photoOptional')}</label>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleFileChange} style={{ display: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          {imagePreviews.length > 0 ? (
            imagePreviews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--ks-border)' }} />
            ))
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: 10, background: 'var(--ks-linen)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
            }} aria-hidden="true">📷</div>
          )}
          <button
            id="product-photo-btn"
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 9,
              padding: '11px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--ks-indigo)',
              fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 44,
            }}
          >
            {imagePreviews.length > 0 ? t('products.changePhoto') : t('products.addPhoto')}
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: 'var(--ks-muted)', marginBottom: 16 }}>{t('products.multiplePhotosHint')}</p>

        <label htmlFor="product-name" style={labelStyle}>{t('products.productName')}</label>
        <input
          id="product-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('products.productNamePlaceholder')}
          aria-invalid={!!validationError}
          aria-describedby={validationError ? 'product-name-error' : undefined}
          style={{ ...inputStyle, ...(validationError ? { borderColor: 'var(--ks-clay)' } : {}) }}
        />
        {validationError && (
          <p id="product-name-error" role="alert" style={{ color: 'var(--ks-clay)', fontSize: 12.5, fontWeight: 500, marginTop: -8, marginBottom: 14 }}>
            {validationError}
          </p>
        )}

        <label htmlFor="product-material" style={labelStyle}>{t('products.material')}</label>
        <input
          id="product-material"
          value={material}
          onChange={(e) => setMaterial(e.target.value)}
          placeholder={t('products.materialPlaceholder')}
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        <label style={labelStyle}>{t('products.craftType')}</label>
        <div role="group" aria-label={t('products.craftType')} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {CRAFT_TYPES.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={craftType === c.value}
              onClick={() => setCraftType(c.value)}
              style={{
                background: craftType === c.value ? 'var(--ks-indigo)' : '#fff',
                color: craftType === c.value ? '#fff' : 'var(--ks-earth)',
                border: `1px solid ${craftType === c.value ? 'var(--ks-indigo)' : 'var(--ks-border)'}`,
                borderRadius: 999, padding: '8px 14px', fontSize: 13, fontWeight: 500,
                fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 38,
              }}
            >
              {t(c.key)}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleAdd}
            disabled={saving}
            style={{
              background: 'var(--ks-indigo)', color: '#fff', border: 'none',
              borderRadius: 10, padding: '13px 24px', fontSize: 14.5, fontWeight: 600,
              fontFamily: 'var(--font-body)', cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1, minHeight: 46, flex: 1,
            }}
          >
            {saving ? t('products.saving') : editingId ? t('products.saveChanges') : t('products.addProduct')}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              disabled={saving}
              style={{
                background: '#fff', color: 'var(--ks-earth)', border: '1px solid var(--ks-border)',
                borderRadius: 10, padding: '13px 20px', fontSize: 14.5, fontWeight: 600,
                fontFamily: 'var(--font-body)', cursor: saving ? 'default' : 'pointer', minHeight: 46,
              }}
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      </div>

      {/* Product list */}
      {products === null ? (
        <p style={{ fontSize: 14, color: 'var(--ks-muted)' }}>{t('products.loading')}</p>
      ) : products.length === 0 ? (
        <div style={{
          background: 'var(--ks-ivory)', border: '1px dashed var(--ks-border)',
          borderRadius: 12, padding: '30px 16px', textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, color: 'var(--ks-muted)' }}>
            {t('products.empty')}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 14 }}>
          {products.map((p) => {
            const craftKey = CRAFT_TYPES.find((c) => c.value === p.craft_type)?.key
            const craftLabel = p.craft_type ? (craftKey ? t(craftKey) : p.craft_type) : null
            const metaLine = [craftLabel, p.material].filter(Boolean).join(' · ')
            return (
              <div key={p.id} className="ks-pop-in ks-product-card" style={{
                background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)',
                borderRadius: 12, overflow: 'hidden',
              }}>
                <a href={`/products/${p.id}`} style={{ aspectRatio: '1', background: 'var(--ks-linen)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 26 }} aria-hidden="true">📦</span>
                  )}
                </a>
                <div style={{ padding: '10px 12px 13px' }}>
                  <a href={`/products/${p.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ks-earth)', marginBottom: metaLine ? 3 : 0 }}>{p.name}</div>
                  </a>
                  {metaLine && (
                    <div style={{ fontSize: 11.5, color: 'var(--ks-muted)', lineHeight: 1.4, marginBottom: 8 }}>
                      {metaLine}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, marginTop: metaLine ? 0 : 8 }}>
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--ks-indigo)', fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font-body)', padding: 0, cursor: 'pointer' }}
                    >
                      {t('products.edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTargetId(p.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--ks-clay)', fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font-body)', padding: 0, cursor: 'pointer' }}
                    >
                      {t('products.delete')}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style jsx>{`
        .ks-product-card {
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        @media (hover: hover) {
          .ks-product-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 18px rgba(19, 42, 69, 0.12);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ks-product-card {
            transition: none;
          }
        }
      `}</style>

      {deleteTargetId && (
        <DeleteConfirmModal
          title={t('products.deleteTitle')}
          warning={t('products.deleteWarning')}
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={() => { handleDelete(deleteTargetId); setDeleteTargetId(null) }}
        />
      )}
    </div>
  )
}

export default function ProductsPage() {
  return (
    <RequireAuth>
      <ProductsPageInner />
    </RequireAuth>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ks-muted)',
  textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid var(--ks-border)',
  borderRadius: 8, padding: '12px 14px', fontSize: 16, fontFamily: 'var(--font-body)',
  color: 'var(--ks-earth)', marginBottom: 16,
}
