export type CatalogueProduct = {
  id: string
  name: string
  material: string | null
  craft_type: string | null
  image_url: string | null
  description: string | null
  craft_story: string | null
}

export type CatalogueLabels = {
  title: string
  material: string
  craft: string
  contact: string
  piece?: string
  pieces?: string
}

// Shared between the catalogue builder's preview (app/catalogue/page.tsx,
// no WhatsApp buttons; those would render as inert clickable-looking shapes
// inside the html2canvas PDF snapshot) and the published public page
// (app/c/[slug]/page.tsx, onWhatsApp wired to a real wa.me link per product).
export default function CatalogueTemplateView({
  template,
  labels,
  products,
  businessName,
  artisanName,
  about,
  photoUrl,
  contact,
  onWhatsApp,
  whatsAppLabel,
}: {
  template: string
  labels: CatalogueLabels
  products: CatalogueProduct[]
  businessName: string
  artisanName: string
  about: string | null
  photoUrl: string | null
  contact: string
  onWhatsApp?: (product: CatalogueProduct) => void
  whatsAppLabel?: string
}) {
  function WhatsAppButton({ product, style }: { product: CatalogueProduct; style?: React.CSSProperties }) {
    if (!onWhatsApp) return null
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onWhatsApp(product) }}
        aria-label={`${whatsAppLabel ?? 'WhatsApp'}: ${product.name}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, background: '#25D366', color: '#fff',
          border: 'none', borderRadius: 999, padding: '8px 15px', fontSize: 12.5, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'var(--font-body)', marginTop: 8,
          boxShadow: '0 2px 8px rgba(37,211,102,0.35)', ...style,
        }}
      >
        💬 {whatsAppLabel ?? 'WhatsApp'}
      </button>
    )
  }

  if (template === 'premium') {
    return (
      <div style={{ width: 720, background: 'var(--ks-ivory)', fontFamily: 'var(--font-body)', color: 'var(--ks-earth)' }}>
        <div style={{ padding: '60px 60px 40px', textAlign: 'center', borderBottom: '1px solid var(--ks-border)' }}>
          <p style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--ks-muted)', marginBottom: 10 }}>{businessName}</p>
          <h1 style={{ fontSize: 30, fontWeight: 400, margin: 0 }}>{labels.title}</h1>
        </div>
        {products.map((p, i) => (
          <div key={p.id} style={{
            display: 'flex', flexDirection: i % 2 === 0 ? 'row' : 'row-reverse',
            alignItems: 'center', gap: 30, padding: '48px 60px', borderBottom: '1px solid var(--ks-border)',
          }}>
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} style={{ width: 260, height: 260, objectFit: 'cover', borderRadius: 4 }} crossOrigin="anonymous" />
            ) : (
              <div style={{ width: 260, height: 260, background: 'var(--ks-linen)', flexShrink: 0, borderRadius: 4 }} />
            )}
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 400, marginBottom: 10 }}>{p.name}</h2>
              {(p.craft_type || p.material) && (
                <p style={{ fontSize: 12, color: 'var(--ks-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
                  {[p.craft_type, p.material].filter(Boolean).join('  ·  ')}
                </p>
              )}
              {(p.description || p.craft_story) && (
                <p style={{ fontSize: 13.5, lineHeight: 1.8, color: 'var(--ks-earth)' }}>{p.description || p.craft_story}</p>
              )}
              <WhatsAppButton product={p} />
            </div>
          </div>
        ))}
        <p style={{ fontSize: 11, color: 'var(--ks-muted)', textAlign: 'center', padding: '30px 0' }}>{labels.contact}: {contact}</p>
      </div>
    )
  }

  if (template === 'story') {
    return (
      <div style={{ width: 700, background: 'var(--ks-ivory)', fontFamily: 'var(--font-body)', color: 'var(--ks-earth)', padding: '44px 44px 30px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={artisanName} style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 14px', border: '2px solid var(--ks-turmeric)' }} crossOrigin="anonymous" />
          ) : (
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--ks-linen)', margin: '0 auto 14px' }} />
          )}
          <h1 style={{ fontSize: 24, margin: 0 }}>{artisanName}</h1>
          <p style={{ fontSize: 13, color: 'var(--ks-clay)', marginTop: 4, fontWeight: 600 }}>{businessName}</p>
          {about && <p style={{ fontSize: 13, lineHeight: 1.7, fontStyle: 'italic', maxWidth: 480, margin: '14px auto 0' }}>&ldquo;{about}&rdquo;</p>}
        </div>
        {products.map((p) => (
          <div key={p.id} style={{ marginBottom: 30, paddingBottom: 30, borderBottom: '1px solid var(--ks-border)' }}>
            {p.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8, marginBottom: 14 }} crossOrigin="anonymous" />
            )}
            <h2 style={{ fontSize: 17, marginBottom: 6 }}>{p.name}</h2>
            {(p.craft_story || p.description) && (
              <p style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--ks-earth)' }}>{p.craft_story || p.description}</p>
            )}
            <WhatsAppButton product={p} />
          </div>
        ))}
        <p style={{ fontSize: 11, color: 'var(--ks-muted)', textAlign: 'center' }}>{labels.contact}: {contact}</p>
      </div>
    )
  }

  if (template === 'collection') {
    return (
      <div style={{ width: 700, background: '#fff', fontFamily: 'var(--font-body)', color: 'var(--ks-earth)', padding: 30 }}>
        <h1 style={{ fontSize: 19, marginBottom: 2 }}>{labels.title}</h1>
        <p style={{ fontSize: 12, color: 'var(--ks-muted)', marginBottom: 18 }}>{businessName} · {products.length} {products.length === 1 ? (labels.piece ?? 'piece') : (labels.pieces ?? 'pieces')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {products.map((p) => (
            <div key={p.id} style={{ border: '1px solid var(--ks-border)', borderRadius: 6, overflow: 'hidden' }}>
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 74, objectFit: 'cover' }} crossOrigin="anonymous" />
              ) : (
                <div style={{ width: '100%', height: 74, background: 'var(--ks-ivory)' }} />
              )}
              <div style={{ padding: '5px 6px', fontSize: 9.5, fontWeight: 600, lineHeight: 1.3 }}>{p.name}</div>
              {onWhatsApp && (
                <div style={{ padding: '0 6px 6px' }}>
                  <WhatsAppButton product={p} style={{ padding: '5px 10px', fontSize: 10.5, marginTop: 0 }} />
                </div>
              )}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 10.5, color: 'var(--ks-muted)', marginTop: 16 }}>{labels.contact}: {contact}</p>
      </div>
    )
  }

  if (template === 'simple') {
    return (
      <div style={{ width: 700, padding: 40, background: '#fff', fontFamily: 'var(--font-body)', color: 'var(--ks-earth)' }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>{labels.title}</h1>
        <p style={{ fontSize: 13, color: 'var(--ks-muted)', marginBottom: 24 }}>{businessName}</p>
        {products.map((p) => (
          <div key={p.id} style={{ borderTop: '1px solid var(--ks-border)', padding: '14px 0', display: 'flex', gap: 14 }}>
            {p.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 4 }} crossOrigin="anonymous" />
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
              {p.craft_type && <div style={{ fontSize: 12, color: 'var(--ks-muted)' }}>{labels.craft}: {p.craft_type}</div>}
              {p.material && <div style={{ fontSize: 12, color: 'var(--ks-muted)' }}>{labels.material}: {p.material}</div>}
              <WhatsAppButton product={p} />
            </div>
          </div>
        ))}
        <p style={{ fontSize: 11, color: 'var(--ks-muted)', marginTop: 24, borderTop: '1px solid var(--ks-border)', paddingTop: 10 }}>{labels.contact}: {contact}</p>
      </div>
    )
  }

  if (template === 'traditional') {
    return (
      <div style={{ width: 700, padding: 0, background: 'var(--ks-paper)', fontFamily: 'var(--font-body)', color: 'var(--ks-earth)' }}>
        <div style={{ background: 'var(--ks-earth)', padding: '28px 40px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, color: '#fff', margin: 0 }}>{labels.title}</h1>
          <p style={{ fontSize: 13, color: 'var(--ks-turmeric)', marginTop: 6 }}>{businessName}</p>
        </div>
        <div className="ks-zari-band" />
        <div style={{ padding: 30, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {products.map((p) => (
            <div key={p.id} style={{ background: 'var(--ks-ivory)', border: '1.5px solid var(--ks-clay)', borderRadius: 10, padding: 14 }}>
              {p.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 6, marginBottom: 8 }} crossOrigin="anonymous" />
              )}
              <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
              {p.craft_type && <div style={{ fontSize: 11, color: 'var(--ks-muted)' }}>{labels.craft}: {p.craft_type}</div>}
              {p.material && <div style={{ fontSize: 11, color: 'var(--ks-muted)' }}>{labels.material}: {p.material}</div>}
              <WhatsAppButton product={p} />
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: 'var(--ks-muted)', padding: '0 30px 24px', textAlign: 'center' }}>{labels.contact}: {contact}</p>
      </div>
    )
  }

  // modern (default)
  return (
    <div style={{ width: 700, padding: 40, background: '#fff', fontFamily: 'var(--font-body)', color: 'var(--ks-earth)' }}>
      <h1 style={{ fontSize: 22, color: 'var(--ks-earth)', marginBottom: 2 }}>{labels.title}</h1>
      <p style={{ fontSize: 13, color: 'var(--ks-muted)', marginBottom: 24 }}>{businessName}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        {products.map((p) => (
          <div key={p.id} style={{ border: '1px solid var(--ks-border)', borderRadius: 10, overflow: 'hidden' }}>
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 100, objectFit: 'cover' }} crossOrigin="anonymous" />
            ) : (
              <div style={{ width: '100%', height: 100, background: 'var(--ks-ivory)' }} />
            )}
            <div style={{ padding: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12.5 }}>{p.name}</div>
              {p.craft_type && <div style={{ fontSize: 10.5, color: 'var(--ks-muted)', marginTop: 2 }}>{p.craft_type}</div>}
              <WhatsAppButton product={p} style={{ padding: '6px 12px', fontSize: 11 }} />
            </div>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--ks-muted)', marginTop: 24 }}>{labels.contact}: {contact}</p>
    </div>
  )
}
