'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/LanguageProvider'
import CatalogueTemplateView, { type CatalogueProduct, type CatalogueLabels } from '@/components/CatalogueTemplateView'
import PeacockMark from '@/components/PeacockMark'

type CatalogueData = {
  labels: CatalogueLabels
  products: CatalogueProduct[]
  artisanName: string
  about: string | null
  photoUrl: string | null
}

type PublicCatalogue = {
  id: string
  slug: string
  title: string
  template: string
  business_name: string
  contact_phone: string | null
  data: CatalogueData
}

export default function PublicCataloguePage() {
  const params = useParams()
  const slug = params.slug as string
  const { t } = useLanguage()
  const [catalogue, setCatalogue] = useState<PublicCatalogue | null | undefined>(undefined)

  // The template inside CatalogueTemplateView renders at a fixed pixel width
  // (700-720px) because it doubles as the source element for the catalogue
  // builder's html2canvas PDF export (app/catalogue/page.tsx); that export
  // reads el.scrollWidth, so the width can't become fluid/percentage-based
  // without breaking PDF fidelity there. Instead, on this public page we
  // measure the rendered template and scale it down visually to fit narrow
  // phone screens, rather than leaving it to horizontally scroll.
  const outerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    if (!supabase || !slug) return
    supabase.from('catalogues').select('*').eq('slug', slug).eq('published', true).maybeSingle()
      .then(({ data }) => setCatalogue(data))
  }, [slug])

  useEffect(() => {
    const outer = outerRef.current
    const content = contentRef.current
    if (!outer || !content) return

    function recompute() {
      if (!outer || !content) return
      const contentWidth = content.scrollWidth
      const contentHeight = content.scrollHeight
      if (!contentWidth || !contentHeight) return
      setNaturalSize({ width: contentWidth, height: contentHeight })
      const outerWidth = outer.clientWidth
      setScale(outerWidth > 0 ? Math.min(1, outerWidth / contentWidth) : 1)
    }

    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(outer)
    ro.observe(content)
    window.addEventListener('resize', recompute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recompute)
    }
  }, [catalogue])

  if (catalogue === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ks-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--ks-muted)', fontSize: 14 }}>{t('publicPage.loading')}</p>
      </div>
    )
  }

  if (catalogue === null) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ks-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ks-earth)', marginBottom: 8 }}>{t('publicPage.notFound')}</p>
          <p style={{ fontSize: 13.5, color: 'var(--ks-muted)', lineHeight: 1.6 }}>{t('publicPage.notFoundDesc')}</p>
        </div>
      </div>
    )
  }

  const { labels, products, artisanName, about, photoUrl } = catalogue.data
  const contactDigits = catalogue.contact_phone?.replace(/[^0-9]/g, '') ?? ''

  function handleWhatsApp(product: CatalogueProduct) {
    if (!contactDigits) return
    const message = t('catalogue.whatsappMessage').replace('{product}', product.name)
    window.open(`https://wa.me/${contactDigits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  const isScaled = scale < 1 && !!naturalSize

  return (
    <div style={{ background: 'var(--ks-paper)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '28px 16px 60px' }}>
        <div
          ref={outerRef}
          style={{
            width: '100%', overflow: 'hidden', background: '#fff', borderRadius: 18,
            border: '1px solid var(--ks-border)', boxShadow: '0 10px 30px rgba(19,42,69,0.12)',
            height: isScaled ? naturalSize!.height * scale : undefined,
          }}
        >
          <div
            ref={contentRef}
            style={isScaled
              ? { transform: `scale(${scale})`, transformOrigin: 'top left', width: naturalSize!.width }
              : { width: 'max-content', margin: '0 auto' }}
          >
            <CatalogueTemplateView
              template={catalogue.template}
              labels={labels}
              products={products}
              businessName={catalogue.business_name}
              artisanName={artisanName}
              about={about}
              photoUrl={photoUrl}
              contact={catalogue.contact_phone || '-'}
              onWhatsApp={contactDigits ? handleWhatsApp : undefined}
              whatsAppLabel={t('catalogue.whatsappShort')}
            />
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ks-muted)', marginTop: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <PeacockMark size={13} />
          {t('publicPage.madeWith')}
        </p>
      </div>
    </div>
  )
}
