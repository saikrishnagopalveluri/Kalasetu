'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/LanguageProvider'
import PeacockMark from '@/components/PeacockMark'

type PublicProduct = {
  id: string
  user_id: string
  name: string
  material: string | null
  craft_type: string | null
  description: string | null
  craft_story: string | null
  image_url: string | null
}

type ArtisanInfo = {
  name: string
  business_name: string | null
  public_contact_phone: string | null
  public_slug: string
}

const AUTO_ADVANCE_MS = 4000

export default function PublicProductPage() {
  const params = useParams<{ slug: string; productId: string }>()
  const { slug, productId } = params
  const { t } = useLanguage()

  const [product, setProduct] = useState<PublicProduct | null | undefined>(undefined)
  const [artisan, setArtisan] = useState<ArtisanInfo | null>(null)
  const [gallerySlides, setGallerySlides] = useState<string[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const hoveringRef = useRef(false)

  useEffect(() => {
    if (!supabase || !productId) return
    supabase.from('public_artisan_products').select('*').eq('id', productId).maybeSingle()
      .then(({ data }) => setProduct(data))
  }, [productId])

  useEffect(() => {
    if (!supabase || !product) return
    supabase.from('public_artisan_catalogues').select('name, business_name, public_contact_phone, public_slug').eq('id', product.user_id).maybeSingle()
      .then(({ data }) => setArtisan(data))
    supabase.from('product_images').select('image_url').eq('product_id', product.id).order('position', { ascending: true })
      .then(({ data }) => setGallerySlides([product.image_url, ...(data ?? []).map((g) => g.image_url)].filter((u): u is string => !!u)))
  }, [product])

  useEffect(() => {
    if (gallerySlides.length <= 1) return
    const timer = setInterval(() => {
      if (hoveringRef.current) return
      setActiveIndex((i) => (i + 1) % gallerySlides.length)
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [gallerySlides.length])

  if (product === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ks-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--ks-muted)', fontSize: 14 }}>{t('publicPage.loading')}</p>
      </div>
    )
  }

  if (product === null) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ks-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ks-earth)', marginBottom: 8 }}>{t('publicPage.notFound')}</p>
          <p style={{ fontSize: 13.5, color: 'var(--ks-muted)', lineHeight: 1.6 }}>{t('publicPage.notFoundDesc')}</p>
          <a href={`/a/${slug}`} style={{ display: 'inline-block', marginTop: 16, color: 'var(--ks-indigo)', fontWeight: 600, fontSize: 14 }}>← {t('publicPage.backToStore')}</a>
        </div>
      </div>
    )
  }

  const hasWhatsApp = !!artisan?.public_contact_phone
  function handleEnquire() {
    if (!artisan?.public_contact_phone) return
    const digits = artisan.public_contact_phone.replace(/[^0-9]/g, '')
    const productUrl = typeof window !== 'undefined' ? window.location.href : ''
    const message = t('publicPage.productEnquiryMessage').replace('{product}', product!.name).replace('{link}', productUrl)
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <div style={{ background: 'var(--ks-paper)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: hasWhatsApp ? '24px 20px 96px' : '24px 20px 60px', fontFamily: 'var(--font-body)' }}>
        <a href={`/a/${slug}`} style={{ display: 'inline-block', color: 'var(--ks-indigo)', fontWeight: 600, fontSize: 13.5, marginBottom: 16, textDecoration: 'none' }}>
          ← {t('publicPage.backToStore')}
        </a>

        {gallerySlides.length > 0 ? (
          <div onMouseEnter={() => { hoveringRef.current = true }} onMouseLeave={() => { hoveringRef.current = false }} style={{ marginBottom: 18 }}>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', maxHeight: 460, background: 'var(--ks-linen)', borderRadius: 14, overflow: 'hidden' }}>
              {gallerySlides.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src + i} src={src} alt={product.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: i === activeIndex ? 1 : 0, transition: 'opacity 0.5s ease' }} />
              ))}
              {gallerySlides.length > 1 && (
                <>
                  <button type="button" aria-label={t('tour.prev')} onClick={() => setActiveIndex((i) => (i - 1 + gallerySlides.length) % gallerySlides.length)} style={carouselArrowStyle('left')}>‹</button>
                  <button type="button" aria-label={t('tour.next')} onClick={() => setActiveIndex((i) => (i + 1) % gallerySlides.length)} style={carouselArrowStyle('right')}>›</button>
                  <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
                    {gallerySlides.map((_, i) => (
                      <button key={i} type="button" aria-label={`${i + 1}`} onClick={() => setActiveIndex(i)} style={{
                        width: 7, height: 7, borderRadius: '50%', border: 'none', padding: 0,
                        background: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.5)',
                        boxShadow: '0 0 0 1px rgba(19,42,69,0.3)', cursor: 'pointer',
                      }} />
                    ))}
                  </div>
                </>
              )}
            </div>
            {gallerySlides.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
                {gallerySlides.map((src, i) => (
                  <button key={src + i} type="button" onClick={() => setActiveIndex(i)} style={{
                    flexShrink: 0, width: 56, height: 56, borderRadius: 8, padding: 0, overflow: 'hidden',
                    border: i === activeIndex ? '2px solid var(--ks-indigo)' : '1px solid var(--ks-border)', cursor: 'pointer', background: 'none',
                  }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ aspectRatio: '4 / 3', maxHeight: 460, background: 'var(--ks-linen)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <span style={{ fontSize: 34 }} aria-hidden="true">📦</span>
          </div>
        )}

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ks-earth)', marginBottom: 6 }}>{product.name}</h1>
        {(product.craft_type || product.material) && (
          <p style={{ fontSize: 13.5, color: 'var(--ks-muted)', marginBottom: 16 }}>
            {[product.craft_type, product.material].filter(Boolean).join(' · ')}
          </p>
        )}

        {product.description && (
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ks-earth)', marginBottom: 16 }}>{product.description}</p>
        )}
        {product.craft_story && (
          <div style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: '18px 20px', marginBottom: 20 }}>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ks-earth)', fontStyle: 'italic' }}>&ldquo;{product.craft_story}&rdquo;</p>
          </div>
        )}

        {artisan && (
          <p style={{ fontSize: 13, color: 'var(--ks-muted)', marginBottom: 24 }}>
            {t('publicPage.myWork')}: <strong style={{ color: 'var(--ks-earth)' }}>{artisan.business_name || artisan.name}</strong>
          </p>
        )}

        {hasWhatsApp ? (
          <div className="ks-whatsapp-inline" style={{ textAlign: 'center', marginTop: 8 }}>
            <button
              type="button"
              onClick={handleEnquire}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--ks-jade)', color: '#fff',
                border: 'none', borderRadius: 999, padding: '15px 32px', fontSize: 15, fontWeight: 700,
                boxShadow: '0 6px 18px rgba(15,91,78,0.3)', cursor: 'pointer', minHeight: 48,
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 17 }}>💬</span> {t('publicPage.enquireWhatsapp')}
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: 'var(--ks-muted)', textAlign: 'center', marginTop: 8 }}>{t('publicPage.whatsappUnavailable')}</p>
        )}

        <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ks-muted)', marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <PeacockMark size={13} />
          {t('publicPage.madeWith')}
        </p>
      </div>

      {hasWhatsApp && (
        <button
          type="button"
          onClick={handleEnquire}
          className="ks-whatsapp-sticky"
          style={{
            display: 'none', alignItems: 'center', justifyContent: 'center', gap: 9,
            position: 'fixed', left: 16, right: 16, bottom: 76, zIndex: 90,
            background: 'var(--ks-jade)', color: '#fff', border: 'none',
            borderRadius: 999, padding: '15px 20px', fontSize: 15, fontWeight: 700,
            boxShadow: '0 8px 24px rgba(19,42,69,0.35)', cursor: 'pointer',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 17 }}>💬</span> {t('publicPage.enquireWhatsapp')}
        </button>
      )}

      <style jsx>{`
        @media (max-width: 640px) {
          .ks-whatsapp-sticky { display: flex !important; }
          .ks-whatsapp-inline { display: none; }
        }
      `}</style>
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
