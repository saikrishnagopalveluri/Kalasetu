'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/useAuth'
import { useAI } from '@/lib/useAI'
import { LANGUAGES } from '@/lib/languages'
import RequireAuth from '@/components/RequireAuth'
import { exportCataloguePPTX, exportCatalogueDOCX, type CatalogueData } from '@/lib/catalogueExport'
import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'
import CatalogueTemplateView, { type CatalogueProduct, type CatalogueLabels } from '@/components/CatalogueTemplateView'

type Product = CatalogueProduct
type Labels = CatalogueLabels

type PublishedCatalogue = { id: string; slug: string; title: string; created_at: string }

const ENGLISH_LABELS: Labels = { title: 'Product Catalogue', material: 'Material', craft: 'Craft', contact: 'Contact', piece: 'piece', pieces: 'pieces' }

// These labels are for the exported document itself (its own Language picker
// below drives AI translation into whatever language the artisan wants that
// specific catalogue in), separate from the session UI language.
const TEMPLATES: { id: string; labelKey: TranslationKey; descKey: TranslationKey }[] = [
  { id: 'modern', labelKey: 'catalogue.template.modern', descKey: 'catalogue.template.modern.desc' },
  { id: 'simple', labelKey: 'catalogue.template.simple', descKey: 'catalogue.template.simple.desc' },
  { id: 'traditional', labelKey: 'catalogue.template.traditional', descKey: 'catalogue.template.traditional.desc' },
  { id: 'premium', labelKey: 'catalogue.template.premium', descKey: 'catalogue.template.premium.desc' },
  { id: 'story', labelKey: 'catalogue.template.story', descKey: 'catalogue.template.story.desc' },
  { id: 'collection', labelKey: 'catalogue.template.collection', descKey: 'catalogue.template.collection.desc' },
]

function CataloguePageInner() {
  const { user, profile } = useAuth()
  const { t, language: uiLanguage } = useLanguage()
  const { ask } = useAI()
  const [products, setProducts] = useState<Product[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [template, setTemplate] = useState<typeof TEMPLATES[number]['id']>('modern')
  const [language, setLanguage] = useState<typeof LANGUAGES[number]['id']>(uiLanguage)
  // See app/content/page.tsx for why this follows the site's own language
  // rather than always starting at English.
  useEffect(() => { setLanguage(uiLanguage) }, [uiLanguage])
  const [labels, setLabels] = useState<Labels>(ENGLISH_LABELS)
  const [preparing, setPreparing] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [downloadError, setDownloadError] = useState('')
  const [exporting, setExporting] = useState<'pdf' | 'pptx' | 'docx' | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  const [slug, setSlug] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState('')
  const [publishError, setPublishError] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const [published, setPublished] = useState<PublishedCatalogue[]>([])

  useEffect(() => {
    if (!supabase || !user) return
    supabase
      .from('products')
      .select('id, name, material, craft_type, image_url, description, craft_story')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setProducts(data ?? [])
        setSelected(new Set((data ?? []).map((p) => p.id)))
      })
    loadPublished()
  }, [user])

  function loadPublished() {
    if (!supabase || !user) return
    supabase.from('catalogues').select('id, slug, title, created_at').eq('user_id', user.id).eq('published', true)
      .order('created_at', { ascending: false }).then(({ data }) => setPublished(data ?? []))
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handlePrepare() {
    setPreparing(true)
    if (language === 'en') {
      setLabels(ENGLISH_LABELS)
    } else {
      const languageName = LANGUAGES.find((l) => l.id === language)?.name ?? 'English'
      const prompt = `Translate this JSON object's values into ${languageName}. Keep the keys exactly the same. Respond with ONLY the JSON object, no other text, no markdown code fences.\n\n${JSON.stringify(ENGLISH_LABELS)}`
      const raw = await ask(prompt, 'general')
      try {
        const cleaned = raw.replace(/^```json\s*|```\s*$/g, '').trim()
        setLabels({ ...ENGLISH_LABELS, ...JSON.parse(cleaned) })
      } catch {
        setLabels(ENGLISH_LABELS) // fall back rather than show broken/untranslated JSON
      }
    }
    setPreparing(false)
    setShowPreview(true)
  }

  function buildCatalogueData(): CatalogueData {
    return {
      title: labels.title,
      businessName: profile?.business_name || profile?.name || 'Artisan',
      contactLabel: `${labels.contact}: ${profile?.public_contact_phone || profile?.phone || '-'}`,
      products: selectedProducts.map((p) => ({
        id: p.id,
        name: p.name,
        material: p.material,
        craftType: p.craft_type,
        description: p.description,
        craftStory: p.craft_story,
        imageUrl: p.image_url,
      })),
    }
  }

  async function handlePublishWebpage() {
    if (!user) return
    const cleanSlug = slugify(slug)
    if (!cleanSlug) { setPublishError(t('profile.enterPageName')); return }
    setPublishing(true)
    setPublishError('')
    setPublishedUrl('')

    // Check up front whether this slug belongs to someone else, rather than
    // finding out only from the write failing. `slug` is globally unique
    // across all artisans (not scoped per user), so a collision is a real,
    // fairly likely outcome for short/common page names — RLS blocks the
    // overwrite either way, but checking first gives an immediate, correct
    // "already taken" message instead of a vague failure after a write attempt.
    const { data: existing } = await supabase!.from('catalogues').select('user_id').eq('slug', cleanSlug).maybeSingle()
    if (existing && existing.user_id !== user.id) {
      setPublishing(false)
      setPublishError(t('profile.nameTaken'))
      return
    }

    const contact = profile?.public_contact_phone || profile?.phone || ''
    const { error } = await supabase!.from('catalogues').upsert({
      user_id: user.id,
      slug: cleanSlug,
      title: labels.title,
      template,
      language,
      business_name: profile?.business_name || profile?.name || 'Artisan',
      contact_phone: contact || null,
      published: true,
      data: {
        labels,
        products: selectedProducts,
        artisanName: profile?.name ?? 'Artisan',
        about: profile?.about ?? null,
        photoUrl: profile?.profile_photo_url ?? null,
      },
    }, { onConflict: 'slug' })

    setPublishing(false)
    if (error) {
      // Defense-in-depth for the race where someone else claims the slug
      // between the check above and this write: RLS denials on Postgres
      // (code 42501) reach here as a permission error, not a 'duplicate'
      // message, since this is an UPDATE-on-conflict, not a plain insert.
      const isNameConflict = error.message.includes('duplicate') || error.code === '42501' || error.message.toLowerCase().includes('row-level security')
      setPublishError(isNameConflict ? t('profile.nameTaken') : t('profile.publishFailed'))
      return
    }
    setSlug(cleanSlug)
    setPublishedUrl(`${window.location.origin}/c/${cleanSlug}`)
    loadPublished()
  }

  async function handleUnpublishCatalogue(id: string) {
    await supabase!.from('catalogues').update({ published: false }).eq('id', id)
    loadPublished()
  }

  // Loads a previously-published catalogue's settings back into the builder
  // so it can be changed and re-published; upsert on slug (handlePublishWebpage)
  // then overwrites the same live page instead of creating a new one.
  async function handleEditCatalogue(id: string) {
    if (!supabase) return
    const { data } = await supabase.from('catalogues').select('*').eq('id', id).maybeSingle()
    if (!data) return
    setTemplate(data.template)
    setLanguage(data.language)
    setSlug(data.slug)
    setLabels(data.data.labels)
    const savedIds = new Set<string>((data.data.products ?? []).map((p: { id: string }) => p.id))
    setSelected(savedIds)
    setShowPreview(true)
    setPublishedUrl('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleCopyLink() {
    if (!publishedUrl) return
    await navigator.clipboard.writeText(publishedUrl)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function handleDownloadPDF() {
    if (!previewRef.current) return
    setDownloadError('')
    setExporting('pdf')
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const el = previewRef.current
      const canvas = await html2canvas(el, {
        scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff',
        // Measuring inside a scrolling wrapper can report width 0, so pin the
        // known template width explicitly instead of relying on auto-detect.
        width: el.scrollWidth || 700,
        height: el.scrollHeight,
        windowWidth: el.scrollWidth || 700,
        windowHeight: el.scrollHeight,
      })
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('Rendered canvas is empty')
      }
      const pdf = new jsPDF('p', 'pt', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgHeight = (canvas.height * pageWidth) / canvas.width
      let heightLeft = imgHeight
      let position = 0
      // Pass the canvas element directly (not a data URL) to avoid a PNG
      // re-encode/parse round trip that breaks if any product image is tainted.
      pdf.addImage(canvas, 'PNG', 0, position, pageWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position -= pageHeight
        pdf.addPage()
        pdf.addImage(canvas, 'PNG', 0, position, pageWidth, imgHeight)
        heightLeft -= pageHeight
      }
      pdf.save(`catalogue-${template}-${language}.pdf`)
    } catch (err) {
      console.error('PDF generation failed:', err)
      setDownloadError(t('catalogue.pdfError'))
    } finally {
      setExporting(null)
    }
  }

  async function handleDownloadPPTX() {
    setDownloadError('')
    setExporting('pptx')
    try {
      await exportCataloguePPTX(buildCatalogueData(), `catalogue-${language}.pptx`)
    } catch (err) {
      console.error('PPTX generation failed:', err)
      setDownloadError(t('catalogue.pptError'))
    } finally {
      setExporting(null)
    }
  }

  async function handleDownloadDOCX() {
    setDownloadError('')
    setExporting('docx')
    try {
      await exportCatalogueDOCX(buildCatalogueData(), `catalogue-${language}.docx`)
    } catch (err) {
      console.error('DOCX generation failed:', err)
      setDownloadError(t('catalogue.docxError'))
    } finally {
      setExporting(null)
    }
  }

  const selectedProducts = products.filter((p) => selected.has(p.id))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1.15 }}>📖</span>
        <div>
          <h1 style={pageTitleStyle}>{t('catalogue.title')}</h1>
          <p style={pageSubtitleStyle}>{t('catalogue.subtitle')}</p>
        </div>
      </div>
      <div className="ks-frieze" style={{ marginBottom: 28 }} />

      {products.length === 0 ? (
        <div className="ks-lattice" style={{ backgroundColor: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', borderRadius: 14, padding: '28px 18px', textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: 'var(--ks-earth)', lineHeight: 1.6 }}>
            {t('catalogue.noProducts')} <a href="/products" style={{ color: 'var(--ks-indigo)', fontWeight: 600 }}>{t('catalogue.addSomeFirst')}</a>.
          </p>
        </div>
      ) : (
        <>
          <p id="catalogue-products-heading" style={sectionLabel}>{t('catalogue.chooseProducts')} ({selected.size})</p>
          <div role="group" aria-labelledby="catalogue-products-heading" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {products.map((p) => (
              <label key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, background: 'var(--ks-ivory)',
                border: '1px solid var(--ks-border)', borderRadius: 10, padding: '11px 14px', cursor: 'pointer',
              }}>
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--ks-linen)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }} aria-hidden="true">📦</div>
                )}
                <span style={{ fontSize: 13.5, color: 'var(--ks-earth)' }}>{p.name}</span>
              </label>
            ))}
          </div>

          <p id="catalogue-template-heading" style={sectionLabel}>{t('catalogue.template')}</p>
          <div role="group" aria-labelledby="catalogue-template-heading" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 24 }}>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => setTemplate(tpl.id)}
                aria-pressed={template === tpl.id}
                style={{
                  background: template === tpl.id ? 'var(--ks-indigo)' : 'var(--ks-ivory)',
                  color: template === tpl.id ? '#fff' : 'var(--ks-earth)',
                  border: `1px solid ${template === tpl.id ? 'var(--ks-indigo)' : 'var(--ks-border)'}`,
                  borderRadius: 10, padding: '12px', textAlign: 'left', fontFamily: 'var(--font-body)',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{t(tpl.labelKey)}</div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 3, lineHeight: 1.4 }}>{t(tpl.descKey)}</div>
              </button>
            ))}
          </div>

          <label htmlFor="catalogue-language-select" style={{ ...sectionLabel, display: 'block' }}>{t('catalogue.language')}</label>
          <select
            id="catalogue-language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as typeof language)}
            style={{
              background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 8,
              padding: '9px 10px', fontSize: 13, fontFamily: 'var(--font-body)',
              color: 'var(--ks-earth)', marginBottom: 24, width: 'auto', minWidth: 200,
            }}
          >
            {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label} ({l.name})</option>)}
          </select>

          <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handlePrepare}
              disabled={selected.size === 0 || preparing}
              style={{
                background: 'var(--ks-indigo)', color: '#fff', border: 'none', borderRadius: 10,
                padding: '13px 24px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
                display: 'inline-flex', alignItems: 'center',
                cursor: preparing ? 'default' : 'pointer', opacity: selected.size === 0 || preparing ? 0.6 : 1,
              }}
            >
              {preparing && <span className="ks-spinner" aria-hidden="true" />}
              {preparing ? t('catalogue.preparing') : t('catalogue.previewCatalogue')}
            </button>
            {showPreview && (
              <>
                <button type="button" onClick={handleDownloadPDF} disabled={exporting !== null} style={{
                  background: 'var(--ks-turmeric)', color: 'var(--ks-earth)', border: 'none', borderRadius: 10,
                  padding: '13px 20px', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-body)',
                  display: 'inline-flex', alignItems: 'center',
                  cursor: exporting ? 'default' : 'pointer', opacity: exporting && exporting !== 'pdf' ? 0.5 : 1,
                }}>
                  {exporting === 'pdf' && <span className="ks-spinner ks-spinner-dark" aria-hidden="true" />}
                  {exporting === 'pdf' ? t('catalogue.creating') : t('catalogue.downloadPDF')}
                </button>
                <button type="button" onClick={handleDownloadPPTX} disabled={exporting !== null} style={{
                  background: 'var(--ks-ivory)', color: 'var(--ks-earth)', border: '1px solid var(--ks-border)', borderRadius: 10,
                  padding: '13px 20px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
                  display: 'inline-flex', alignItems: 'center',
                  cursor: exporting ? 'default' : 'pointer', opacity: exporting && exporting !== 'pptx' ? 0.5 : 1,
                }}>
                  {exporting === 'pptx' && <span className="ks-spinner ks-spinner-dark" aria-hidden="true" />}
                  {exporting === 'pptx' ? t('catalogue.creating') : t('catalogue.downloadPPT')}
                </button>
                <button type="button" onClick={handleDownloadDOCX} disabled={exporting !== null} style={{
                  background: 'var(--ks-ivory)', color: 'var(--ks-earth)', border: '1px solid var(--ks-border)', borderRadius: 10,
                  padding: '13px 20px', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)',
                  display: 'inline-flex', alignItems: 'center',
                  cursor: exporting ? 'default' : 'pointer', opacity: exporting && exporting !== 'docx' ? 0.5 : 1,
                }}>
                  {exporting === 'docx' && <span className="ks-spinner ks-spinner-dark" aria-hidden="true" />}
                  {exporting === 'docx' ? t('catalogue.creating') : t('catalogue.downloadWord')}
                </button>
              </>
            )}
          </div>
          {downloadError && (
            <p role="alert" style={{ ...inlineErrorStyle, marginTop: -12, marginBottom: 20 }}>
              <span aria-hidden="true" style={{ color: 'var(--ks-clay)' }}>⚠</span> {downloadError}
            </p>
          )}

          {showPreview && (
            <div style={{ background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, padding: 18, marginBottom: 24 }}>
              <p style={sectionLabel}>{t('catalogue.publishWebpage')}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <label htmlFor="catalogue-slug-input" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                  {t('profile.pageName')}
                </label>
                <input
                  id="catalogue-slug-input"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={t('profile.pageName')}
                  style={{
                    background: '#fff', border: '1px solid var(--ks-border)', borderRadius: 8,
                    padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-body)',
                    color: 'var(--ks-earth)', flex: '1 1 200px', minWidth: 160,
                  }}
                />
                <button
                  type="button"
                  onClick={handlePublishWebpage}
                  disabled={publishing || !slug.trim()}
                  style={{
                    background: 'var(--ks-indigo)', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '10px 18px', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-body)',
                    display: 'inline-flex', alignItems: 'center',
                    cursor: publishing ? 'default' : 'pointer', opacity: publishing || !slug.trim() ? 0.6 : 1,
                  }}
                >
                  {publishing && <span className="ks-spinner" aria-hidden="true" />}
                  {publishing ? t('profile.publishing') : t('catalogue.publishWebpage')}
                </button>
              </div>
              {publishError && (
                <p role="alert" style={{ ...inlineErrorStyle, marginTop: 10 }}>
                  <span aria-hidden="true" style={{ color: 'var(--ks-clay)' }}>⚠</span> {publishError}
                </p>
              )}
              {publishedUrl && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <p style={{ fontSize: 12.5, color: 'var(--ks-muted)' }}>{t('catalogue.publishedAs')}</p>
                  <a href={publishedUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: 'var(--ks-indigo)', wordBreak: 'break-all', fontWeight: 600 }}>
                    {publishedUrl}
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    style={{
                      background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 6,
                      padding: '4px 10px', fontSize: 11.5, color: 'var(--ks-earth)', fontWeight: 500,
                    }}
                  >
                    {linkCopied ? t('catalogue.linkCopied') : t('catalogue.copyLink')}
                  </button>
                </div>
              )}

              {published.length > 0 && (
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--ks-border)' }}>
                  <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ks-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('catalogue.myPublished')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {published.map((c) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <a href={`/c/${c.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, color: 'var(--ks-indigo)', fontWeight: 600 }}>
                          {c.title} (/c/{c.slug})
                        </a>
                        <button
                          type="button"
                          onClick={() => handleEditCatalogue(c.id)}
                          aria-label={`${t('catalogue.edit')}: ${c.title}`}
                          style={{
                            background: 'transparent', border: 'none', color: 'var(--ks-indigo)', fontSize: 11.5, fontWeight: 600,
                            padding: 0,
                          }}
                        >
                          {t('catalogue.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUnpublishCatalogue(c.id)}
                          aria-label={`${t('profile.unpublish')}: ${c.title}`}
                          style={{
                            background: 'transparent', border: 'none', color: 'var(--ks-clay)', fontSize: 11.5, fontWeight: 600,
                            padding: 0,
                          }}
                        >
                          {t('profile.unpublish')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showPreview && (
        <div className="ks-pop-in" style={{ overflowX: 'auto', border: '1px solid var(--ks-border)', borderRadius: 14, padding: 12 }}>
          <div ref={previewRef}>
            <CatalogueTemplateView
              template={template}
              labels={labels}
              products={selectedProducts}
              businessName={profile?.business_name || profile?.name || 'Artisan'}
              artisanName={profile?.name ?? 'Artisan'}
              about={profile?.about ?? null}
              photoUrl={profile?.profile_photo_url ?? null}
              contact={profile?.public_contact_phone || profile?.phone || '-'}
            />
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes ks-spin { to { transform: rotate(360deg); } }
        .ks-spinner {
          width: 14px; height: 14px; border-radius: 50%; display: inline-block;
          border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
          animation: ks-spin 0.7s linear infinite; vertical-align: -2px; margin-right: 8px;
        }
        .ks-spinner-dark {
          border: 2px solid rgba(19,42,69,0.25); border-top-color: var(--ks-earth);
        }
        @media (prefers-reduced-motion: reduce) {
          .ks-spinner { animation: none; }
        }
      `}</style>
    </div>
  )
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
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

const inlineErrorStyle: React.CSSProperties = {
  color: 'var(--ks-earth)', fontSize: 12.5, fontWeight: 500,
}

export default function CataloguePage() {
  return (
    <RequireAuth>
      <CataloguePageInner />
    </RequireAuth>
  )
}
