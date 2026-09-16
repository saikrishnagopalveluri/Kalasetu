'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import RequireAuth from '@/components/RequireAuth'
import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'
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

type ProductRow = {
  id: string
  user_id: string
  name: string
  material: string | null
  craft_type: string | null
  image_url: string | null
}

type GalleryImage = { id: string; image_url: string }

const AUTO_ADVANCE_MS = 4000

function ProductDetailInner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useLanguage()

  const [product, setProduct] = useState<ProductRow | null | undefined>(undefined)
  const [gallery, setGallery] = useState<GalleryImage[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [name, setName] = useState('')
  const [material, setMaterial] = useState('')
  const [craftType, setCraftType] = useState('')
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const addPhotosRef = useRef<HTMLInputElement>(null)
  const hoveringRef = useRef(false)

  const load = useCallback(async () => {
    if (!supabase) return
    const { data: p } = await supabase.from('products').select('id, user_id, name, material, craft_type, image_url').eq('id', id).maybeSingle()
    setProduct(p ?? null)
    if (p) {
      setName(p.name)
      setMaterial(p.material ?? '')
      setCraftType(p.craft_type ?? CRAFT_TYPES[0].value)
    }
    const { data: imgs } = await supabase.from('product_images').select('id, image_url').eq('product_id', id).order('position', { ascending: true })
    setGallery(imgs ?? [])
  }, [id])

  useEffect(() => { load() }, [load])

  const slides = product?.image_url ? [product.image_url, ...gallery.map((g) => g.image_url)] : gallery.map((g) => g.image_url)

  // Amazon-style auto-advancing banner: steps through every slide on a
  // timer, pauses while the pointer is over it, and resets whenever the
  // artisan manually jumps to a slide so it doesn't fight their click.
  useEffect(() => {
    if (slides.length <= 1) return
    const timer = setInterval(() => {
      if (hoveringRef.current) return
      setActiveIndex((i) => (i + 1) % slides.length)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [slides.length])

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0)
  }, [slides.length, activeIndex])

  const isOwner = !!user && product?.user_id === user.id

  async function handleSaveInfo() {
    if (!supabase || !product || !name.trim()) return
    setSaving(true)
    await supabase.from('products').update({ name, material: material || null, craft_type: craftType }).eq('id', product.id)
    setSaving(false)
    await load()
  }

  async function handleAddPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0 || !supabase || !user || !product) return
    const startPosition = gallery.length
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('product-images').upload(path, file)
      if (uploadError) { console.error('Image upload failed:', uploadError.message); continue }
      const url = supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
      await supabase.from('product_images').insert({ product_id: product.id, image_url: url, position: startPosition + i })
    }
    if (addPhotosRef.current) addPhotosRef.current.value = ''
    await load()
  }

  async function handleRemoveGalleryImage(imageId: string) {
    const image = gallery.find((g) => g.id === imageId)
    await supabase?.from('product_images').delete().eq('id', imageId)
    await removeFromStorage('product-images', [image?.image_url])
    await load()
  }

  async function handleDeleteProduct() {
    if (!product) return
    await supabase?.from('products').delete().eq('id', product.id)
    await removeFromStorage('product-images', [product.image_url, ...gallery.map((g) => g.image_url)])
    router.push('/products')
  }

  if (product === undefined) {
    return <p style={{ fontSize: 14, color: 'var(--ks-muted)' }}>{t('products.loading')}</p>
  }
  if (product === null) {
    return (
      <div>
        <p style={{ fontSize: 14, color: 'var(--ks-earth)', marginBottom: 16 }}>{t('products.notFound')}</p>
        <a href="/products" style={{ color: 'var(--ks-indigo)', fontWeight: 600, fontSize: 14 }}>← {t('products.backToProducts')}</a>
      </div>
    )
  }

  return (
    <div>
      <a href="/products" style={{ display: 'inline-block', color: 'var(--ks-indigo)', fontWeight: 600, fontSize: 13.5, marginBottom: 16, textDecoration: 'none' }}>
        ← {t('products.backToProducts')}
      </a>

      {/* Banner / carousel */}
      {slides.length > 0 ? (
        <div
          onMouseEnter={() => { hoveringRef.current = true }}
          onMouseLeave={() => { hoveringRef.current = false }}
          style={{ marginBottom: 12 }}
        >
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '4 / 3', maxHeight: 460,
            background: 'var(--ks-linen)', borderRadius: 14, overflow: 'hidden',
          }}>
            {slides.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src + i}
                src={src}
                alt={name}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
                  opacity: i === activeIndex ? 1 : 0,
                  transition: 'opacity 0.5s ease',
                }}
              />
            ))}
            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label={t('tour.prev')}
                  onClick={() => setActiveIndex((i) => (i - 1 + slides.length) % slides.length)}
                  style={carouselArrowStyle('left')}
                >‹</button>
                <button
                  type="button"
                  aria-label={t('tour.next')}
                  onClick={() => setActiveIndex((i) => (i + 1) % slides.length)}
                  style={carouselArrowStyle('right')}
                >›</button>
                <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
                  {slides.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`${i + 1}`}
                      onClick={() => setActiveIndex(i)}
                      style={{
                        width: 7, height: 7, borderRadius: '50%', border: 'none', padding: 0,
                        background: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                        boxShadow: '0 0 0 1px rgba(19,42,69,0.3)', cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {slides.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {slides.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  style={{
                    flexShrink: 0, width: 56, height: 56, borderRadius: 8, padding: 0, overflow: 'hidden',
                    border: i === activeIndex ? '2px solid var(--ks-indigo)' : '1px solid var(--ks-border)',
                    cursor: 'pointer', background: 'none',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          aspectRatio: '4 / 3', maxHeight: 460, background: 'var(--ks-linen)', borderRadius: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
        }}>
          <span style={{ fontSize: 34 }} aria-hidden="true">📦</span>
        </div>
      )}

      {isOwner && (
        <>
          <input ref={addPhotosRef} type="file" accept="image/*" multiple onChange={handleAddPhotos} style={{ display: 'none' }} />
          <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => addPhotosRef.current?.click()} style={secondaryButtonStyle}>
              {t('products.addMorePhotos')}
            </button>
            {gallery.length > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {gallery.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleRemoveGalleryImage(g.id)}
                    aria-label={`${t('products.removePhoto')}`}
                    style={{ background: 'transparent', border: 'none', color: 'var(--ks-clay)', fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                  >
                    {t('products.removePhoto')} #{gallery.indexOf(g) + 2}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Product info, editable when the viewer owns this product */}
      <div style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
        {isOwner ? (
          <>
            <label htmlFor="pd-name" style={labelStyle}>{t('products.productName')}</label>
            <input id="pd-name" value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />

            <label htmlFor="pd-material" style={labelStyle}>{t('products.material')}</label>
            <input id="pd-material" value={material} onChange={(e) => setMaterial(e.target.value)} style={{ ...inputStyle, marginBottom: 16 }} />

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
              <button onClick={handleSaveInfo} disabled={saving || !name.trim()} style={{
                background: 'var(--ks-indigo)', color: '#fff', border: 'none', borderRadius: 10,
                padding: '12px 22px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
                cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
              }}>
                {saving ? t('products.saving') : t('products.saveChanges')}
              </button>
              <button type="button" onClick={() => setShowDeleteConfirm(true)} style={{
                background: 'transparent', color: 'var(--ks-clay)', border: '1px solid rgba(196,85,45,0.4)',
                borderRadius: 10, padding: '12px 18px', fontSize: 13.5, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer',
              }}>
                {t('products.delete')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ks-earth)', marginBottom: 6 }}>{name}</div>
            <div style={{ fontSize: 13.5, color: 'var(--ks-muted)' }}>
              {[CRAFT_TYPES.find((c) => c.value === craftType) ? t(CRAFT_TYPES.find((c) => c.value === craftType)!.key) : craftType, material].filter(Boolean).join(' · ')}
            </div>
          </>
        )}
      </div>

      {showDeleteConfirm && (
        <DeleteConfirmModal
          title={t('products.deleteTitle')}
          warning={t('products.deleteWarning')}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteProduct}
        />
      )}
    </div>
  )
}

function carouselArrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: 10,
    width: 34, height: 34, borderRadius: '50%', border: 'none',
    background: 'rgba(19,42,69,0.55)', color: '#fff', fontSize: 20, lineHeight: 1,
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--ks-muted)',
  textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8,
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: '#fff', border: '1px solid var(--ks-border)',
  borderRadius: 8, padding: '12px 14px', fontSize: 16, fontFamily: 'var(--font-body)',
  color: 'var(--ks-earth)',
}

const secondaryButtonStyle: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 9,
  padding: '11px 16px', fontSize: 13.5, fontWeight: 600, color: 'var(--ks-indigo)',
  fontFamily: 'var(--font-body)', cursor: 'pointer', minHeight: 44,
}

export default function ProductDetailPage() {
  return (
    <RequireAuth>
      <ProductDetailInner />
    </RequireAuth>
  )
}
