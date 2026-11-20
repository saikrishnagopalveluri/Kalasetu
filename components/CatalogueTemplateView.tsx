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
  // Added later; catalogues published before then do not have these, so
  // every template treats them as optional.
  handmadeBy?: string
  tagline?: string
  story?: string
  enquire?: string
}

// Shared between the catalogue builder's preview (app/catalogue/page.tsx,
// no WhatsApp buttons; those would render as inert clickable-looking shapes
// inside the html2canvas PDF snapshot) and the published public page
// (app/c/[slug]/page.tsx, onWhatsApp wired to a real wa.me link per product).
//
// Every template renders at a fixed pixel width because it is also the
// source element for the PDF export, and only uses CSS that html2canvas
// draws faithfully (solid colours, simple gradients, borders, radii,
// shadows; no filters, masks or background-clip text).

const INK = '#132A45'
const CLAY = '#C4552D'
const GOLD = '#D4A017'
const JADE = '#0F5B4E'
const PAPER = '#F4EFE6'
const IVORY = '#FAF7F0'
const MUTED = '#5C6B7A'
const HAIRLINE = 'rgba(19,42,69,0.14)'

function clip(text: string | null | undefined, max: number): string {
  if (!text) return ''
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
}

function count(n: number, labels: CatalogueLabels): string {
  return `${n} ${n === 1 ? (labels.piece ?? 'piece') : (labels.pieces ?? 'pieces')}`
}

// A small repeated diamond border, the house motif (see .ks-frieze), drawn
// with plain elements so it survives the PDF snapshot.
function MotifRow({ color = GOLD, count: n = 28, size = 6 }: { color?: string; count?: number; size?: number }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', gap: size * 1.4, padding: '2px 0' }}>
      {Array.from({ length: n }, (_, i) => (
        <span key={i} style={{ width: size, height: size, background: i % 2 ? 'transparent' : color, border: `1px solid ${color}`, transform: 'rotate(45deg)', display: 'inline-block' }} />
      ))}
    </div>
  )
}

// Soft craft-colour tints for products without a photo, picked from the
// product name so the same product always gets the same colour.
const TINTS: [string, string][] = [
  ['#F3E1D3', CLAY], ['#DCEBE5', JADE], ['#F6E9C6', '#8A6A12'], ['#DDE3EC', INK],
]

function tintFor(name: string): [string, string] {
  let sum = 0
  for (const ch of name) sum += ch.codePointAt(0) ?? 0
  return TINTS[sum % TINTS.length]
}

function ProductImage({ product, width, height, radius = 0, style }: { product: CatalogueProduct; width: number | string; height: number; radius?: number; style?: React.CSSProperties }) {
  if (!product.image_url) {
    // No photo yet: the product's first letter in the display face, on a
    // tint, with the house diamond border, instead of a stock emoji.
    const [bg, ink] = tintFor(product.name || '?')
    const initial = Array.from((product.name || '?').trim())[0]?.toUpperCase() ?? '?'
    return (
      <div aria-hidden="true" style={{
        width, height, borderRadius: radius, flexShrink: 0, background: bg, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...style,
      }}>
        <div style={{ position: 'absolute', top: 10, left: 0, right: 0 }}><MotifRow color={ink} count={9} size={5} /></div>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: Math.min(64, Math.round(height * 0.36)), color: ink, lineHeight: 1 }}>{initial}</span>
        <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0 }}><MotifRow color={ink} count={9} size={5} /></div>
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={product.image_url} alt={product.name} crossOrigin="anonymous"
      style={{ width, height, objectFit: 'cover', borderRadius: radius, display: 'block', flexShrink: 0, ...style }} />
  )
}

function Chip({ children, color = CLAY }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display: 'inline-block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', color,
      border: `1px solid ${color}`, borderRadius: 999, padding: '2px 9px', lineHeight: 1.5,
    }}>{children}</span>
  )
}

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
          cursor: 'pointer', fontFamily: 'var(--font-body)', marginTop: 10,
          boxShadow: '0 2px 8px rgba(37,211,102,0.35)', ...style,
        }}
      >
        💬 {whatsAppLabel ?? 'WhatsApp'}
      </button>
    )
  }

  const footer = (dark = false) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      padding: '16px 0 0', marginTop: 8, borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.2)' : HAIRLINE}`,
      fontSize: 11.5, color: dark ? 'rgba(255,255,255,0.85)' : MUTED,
    }}>
      <span>{labels.enquire ? `${labels.enquire} ${businessName}` : businessName}</span>
      <span style={{ fontWeight: 700, color: dark ? GOLD : INK }}>{labels.contact}: {contact}</span>
    </div>
  )

  // ── Premium: luxury editorial, alternating rows, gold hairlines ─────────
  if (template === 'premium') {
    return (
      <div className="ks-catalogue" style={{ width: 720, background: IVORY, fontFamily: 'var(--font-body)', color: INK }}>
        <div style={{ padding: '56px 64px 36px', textAlign: 'center', background: `linear-gradient(180deg, ${PAPER} 0%, ${IVORY} 100%)` }}>
          <div style={{ width: 54, height: 54, margin: '0 auto 16px', border: `1px solid ${GOLD}`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 22, color: GOLD }}>
            {businessName.trim().charAt(0).toUpperCase()}
          </div>
          <p style={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: MUTED, margin: 0 }}>{businessName}</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 400, margin: '10px 0 8px' }}>{labels.title}</h1>
          {labels.tagline && <p style={{ fontSize: 13, color: MUTED, fontStyle: 'italic', margin: 0 }}>{labels.tagline}</p>}
          <div style={{ width: 80, height: 1, background: GOLD, margin: '22px auto 0' }} />
        </div>
        {products.map((p, i) => (
          <div key={p.id} style={{
            display: 'flex', flexDirection: i % 2 === 0 ? 'row' : 'row-reverse', alignItems: 'center',
            gap: 36, padding: '40px 64px', borderTop: `1px solid ${HAIRLINE}`,
          }}>
            <div style={{ padding: 8, border: `1px solid ${GOLD}`, flexShrink: 0 }}>
              <ProductImage product={p} width={250} height={290} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, letterSpacing: '0.22em', color: GOLD, margin: '0 0 8px' }}>{String(i + 1).padStart(2, '0')}</p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 25, fontWeight: 400, margin: '0 0 10px', lineHeight: 1.25 }}>{p.name}</h2>
              {(p.craft_type || p.material) && (
                <p style={{ fontSize: 11.5, color: MUTED, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 14px' }}>
                  {[p.craft_type, p.material].filter(Boolean).join('  ·  ')}
                </p>
              )}
              {(p.description || p.craft_story) && (
                <p style={{ fontSize: 13.5, lineHeight: 1.85, margin: 0 }}>{clip(p.description || p.craft_story, 360)}</p>
              )}
              <WhatsAppButton product={p} />
            </div>
          </div>
        ))}
        <div style={{ padding: '18px 64px 34px' }}>{footer()}</div>
      </div>
    )
  }

  // ── Story: the artisan first, each product told as a story ──────────────
  if (template === 'story') {
    return (
      <div className="ks-catalogue" style={{ width: 700, background: IVORY, fontFamily: 'var(--font-body)', color: INK }}>
        <div style={{ background: INK, color: '#fff', padding: '40px 44px 34px', textAlign: 'center' }}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt={artisanName} crossOrigin="anonymous" style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 14px', display: 'block', border: `3px solid ${GOLD}` }} />
          ) : (
            <div aria-hidden="true" style={{ width: 96, height: 96, borderRadius: '50%', background: CLAY, margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 38, border: `3px solid ${GOLD}` }}>
              {artisanName.trim().charAt(0).toUpperCase()}
            </div>
          )}
          {labels.handmadeBy && <p style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: GOLD, margin: '0 0 4px' }}>{labels.handmadeBy}</p>}
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, margin: 0 }}>{artisanName}</h1>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.8)', margin: '4px 0 0' }}>{businessName}</p>
          {about && <p style={{ fontSize: 13.5, lineHeight: 1.75, fontStyle: 'italic', maxWidth: 500, margin: '16px auto 0', color: 'rgba(255,255,255,0.92)' }}>&ldquo;{clip(about, 320)}&rdquo;</p>}
        </div>
        <div style={{ background: CLAY, padding: '6px 0' }}><MotifRow color={IVORY} count={34} size={5} /></div>
        <div style={{ padding: '30px 44px 26px' }}>
          {products.map((p, i) => (
            <div key={p.id} style={{ marginBottom: 30, paddingBottom: 30, borderBottom: i === products.length - 1 ? 'none' : `1px dashed ${HAIRLINE}` }}>
              <ProductImage product={p} width="100%" height={280} radius={14} />
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginTop: 16 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 21, margin: 0 }}>{p.name}</h2>
                {p.craft_type && <Chip>{p.craft_type}</Chip>}
              </div>
              {(p.craft_story || p.description) && (
                <>
                  {labels.story && <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: JADE, margin: '12px 0 4px' }}>{labels.story}</p>}
                  <p style={{ fontSize: 13.5, lineHeight: 1.85, margin: 0 }}>{clip(p.craft_story || p.description, 520)}</p>
                </>
              )}
              <WhatsAppButton product={p} />
            </div>
          ))}
          {footer()}
        </div>
      </div>
    )
  }

  // ── Collection: a lookbook grid, numbered pieces ────────────────────────
  if (template === 'collection') {
    return (
      <div className="ks-catalogue" style={{ width: 700, background: '#fff', fontFamily: 'var(--font-body)', color: INK, padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, borderBottom: `3px solid ${INK}`, paddingBottom: 14, marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: CLAY, margin: '0 0 4px', fontWeight: 700 }}>{businessName}</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, margin: 0, lineHeight: 1.1 }}>{labels.title}</h1>
          </div>
          <p style={{ fontSize: 13, color: MUTED, margin: 0, whiteSpace: 'nowrap' }}>{count(products.length, labels)}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {products.map((p, i) => (
            <div key={p.id} style={{ position: 'relative' }}>
              <ProductImage product={p} width="100%" height={180} radius={10} />
              <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(255,255,255,0.92)', color: INK, fontSize: 11, fontWeight: 800, borderRadius: 6, padding: '2px 7px' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div style={{ padding: '9px 2px 0' }}>
                <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.35 }}>{p.name}</div>
                {(p.craft_type || p.material) && <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{[p.craft_type, p.material].filter(Boolean).join(' · ')}</div>}
                <WhatsAppButton product={p} style={{ padding: '6px 12px', fontSize: 11, marginTop: 6 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22 }}>{footer()}</div>
      </div>
    )
  }

  // ── Simple: a clean price-list style sheet ──────────────────────────────
  if (template === 'simple') {
    return (
      <div className="ks-catalogue" style={{ width: 700, padding: '40px 44px', background: '#fff', fontFamily: 'var(--font-body)', color: INK }}>
        <div style={{ borderLeft: `5px solid ${CLAY}`, paddingLeft: 14, marginBottom: 26 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 27, margin: 0 }}>{labels.title}</h1>
          <p style={{ fontSize: 13.5, color: MUTED, margin: '4px 0 0' }}>{businessName} · {count(products.length, labels)}</p>
        </div>
        {products.map((p) => (
          <div key={p.id} style={{ borderTop: `1px solid ${HAIRLINE}`, padding: '16px 0', display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <ProductImage product={p} width={96} height={96} radius={10} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 4 }}>
                {p.craft_type && <span style={{ fontSize: 12.5, color: MUTED }}><b style={{ color: INK }}>{labels.craft}:</b> {p.craft_type}</span>}
                {p.material && <span style={{ fontSize: 12.5, color: MUTED }}><b style={{ color: INK }}>{labels.material}:</b> {p.material}</span>}
              </div>
              {(p.description || p.craft_story) && <p style={{ fontSize: 12.5, lineHeight: 1.65, color: INK, margin: '8px 0 0' }}>{clip(p.description || p.craft_story, 200)}</p>}
              <WhatsAppButton product={p} />
            </div>
          </div>
        ))}
        {footer()}
      </div>
    )
  }

  // ── Traditional: navy and gold, zari border, framed cards ───────────────
  if (template === 'traditional') {
    return (
      <div className="ks-catalogue" style={{ width: 700, background: PAPER, fontFamily: 'var(--font-body)', color: INK }}>
        <div style={{ background: INK, padding: '34px 40px 26px', textAlign: 'center' }}>
          <MotifRow color={GOLD} count={22} size={6} />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: '#fff', margin: '14px 0 4px' }}>{labels.title}</h1>
          <p style={{ fontSize: 14, color: GOLD, margin: 0, fontWeight: 600 }}>{businessName}</p>
          {labels.tagline && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: '6px 0 12px', fontStyle: 'italic' }}>{labels.tagline}</p>}
          <MotifRow color={GOLD} count={22} size={6} />
        </div>
        <div style={{ height: 8, background: `repeating-linear-gradient(90deg, ${CLAY} 0 14px, ${GOLD} 14px 28px)` }} />
        <div style={{ padding: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          {products.map((p) => (
            <div key={p.id} style={{ background: IVORY, border: `2px solid ${CLAY}`, borderRadius: 14, padding: 6 }}>
              <div style={{ border: `1px solid ${GOLD}`, borderRadius: 10, padding: 12 }}>
                <ProductImage product={p} width="100%" height={170} radius={8} />
                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                  {p.craft_type && <div style={{ fontSize: 11.5, color: CLAY, fontWeight: 700, marginTop: 3 }}>{labels.craft}: {p.craft_type}</div>}
                  {p.material && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 1 }}>{labels.material}: {p.material}</div>}
                  <WhatsAppButton product={p} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: INK, padding: '4px 28px 20px' }}>{footer(true)}</div>
      </div>
    )
  }

  // ── Modern (default): bright cards with a bold header band ──────────────
  return (
    <div className="ks-catalogue" style={{ width: 700, background: '#fff', fontFamily: 'var(--font-body)', color: INK }}>
      <div style={{ background: `linear-gradient(120deg, ${INK} 0%, #1F3D5E 55%, ${CLAY} 130%)`, padding: '34px 36px 30px', color: '#fff' }}>
        <p style={{ fontSize: 11.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, margin: 0, fontWeight: 700 }}>{businessName}</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, margin: '6px 0 4px' }}>{labels.title}</h1>
        <p style={{ fontSize: 13, opacity: 0.85, margin: 0 }}>{labels.tagline ? `${labels.tagline} · ` : ''}{count(products.length, labels)}</p>
      </div>
      <div style={{ padding: '26px 30px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {products.map((p) => (
          <div key={p.id} style={{ borderRadius: 14, overflow: 'hidden', background: IVORY, border: `1px solid ${HAIRLINE}`, boxShadow: '0 4px 14px rgba(19,42,69,0.08)', display: 'flex', flexDirection: 'column' }}>
            <ProductImage product={p} width="100%" height={150} />
            <div style={{ padding: '12px 13px 14px', flex: 1, borderTop: `3px solid ${GOLD}` }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{p.name}</div>
              {(p.craft_type || p.material) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 6 }}>
                  {p.craft_type && <Chip color={JADE}>{p.craft_type}</Chip>}
                  {p.material && <span style={{ fontSize: 11, color: MUTED }}>{labels.material}: {p.material}</span>}
                </div>
              )}
              {(p.description || p.craft_story) && <p style={{ fontSize: 11.5, lineHeight: 1.6, margin: '8px 0 0', color: INK }}>{clip(p.description || p.craft_story, 110)}</p>}
              <WhatsAppButton product={p} style={{ padding: '6px 12px', fontSize: 11 }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 30px 28px' }}>{footer()}</div>
    </div>
  )
}
