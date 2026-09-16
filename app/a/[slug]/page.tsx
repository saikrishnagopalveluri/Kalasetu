'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/lib/LanguageProvider'
import { LANGUAGES } from '@/lib/languages'
import PeacockMark from '@/components/PeacockMark'

type PublicProfile = {
  id: string
  public_slug: string
  name: string
  business_name: string | null
  about: string | null
  profile_photo_url: string | null
  craft_type: string | null
  state: string | null
  public_contact_phone: string | null
  languages_known: string[] | null
}
type PublicProduct = { id: string; name: string; material: string | null; craft_type: string | null; description: string | null; image_url: string | null }
type PublicAchievement = { id: string; title: string; issuing_organization: string | null; year: number | null; description: string | null }

export default function PublicCataloguePage() {
  const params = useParams()
  const slug = params.slug as string
  const { t } = useLanguage()
  const [profile, setProfile] = useState<PublicProfile | null | undefined>(undefined)
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [achievements, setAchievements] = useState<PublicAchievement[]>([])

  useEffect(() => {
    if (!supabase || !slug) return
    supabase.from('public_artisan_catalogues').select('*').eq('public_slug', slug).maybeSingle()
      .then(({ data }) => setProfile(data))
  }, [slug])

  useEffect(() => {
    if (!supabase || !profile) return
    supabase.from('public_artisan_products').select('*').eq('user_id', profile.id).then(({ data }) => setProducts(data ?? []))
    supabase.from('public_artisan_achievements').select('*').eq('user_id', profile.id).order('year', { ascending: false }).then(({ data }) => setAchievements(data ?? []))
  }, [profile])

  if (profile === undefined) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ks-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--ks-muted)', fontSize: 14 }}>{t('publicPage.loading')}</p>
      </div>
    )
  }

  if (profile === null) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ks-paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ks-earth)', marginBottom: 8 }}>{t('publicPage.notFound')}</p>
          <p style={{ fontSize: 13.5, color: 'var(--ks-muted)', lineHeight: 1.6 }}>{t('publicPage.notFoundDesc')}</p>
        </div>
      </div>
    )
  }

  const hasWhatsApp = !!profile.public_contact_phone

  return (
    <div style={{ background: 'var(--ks-paper)', minHeight: '100vh' }}>
      <div
        className="ks-store-wrap"
        style={{
          maxWidth: 720, margin: '0 auto',
          padding: hasWhatsApp ? '32px 20px 96px' : '32px 20px 60px',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          {profile.profile_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profile_photo_url}
              alt={profile.name}
              style={{
                width: 104, height: 104, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 16px',
                border: '3px solid var(--ks-ivory)', boxShadow: '0 0 0 2px var(--ks-turmeric), 0 6px 16px rgba(19,42,69,0.15)',
              }}
            />
          ) : (
            <div
              role="img"
              aria-label={profile.name}
              style={{
                width: 104, height: 104, borderRadius: '50%', background: 'var(--ks-linen)', margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36,
                border: '3px solid var(--ks-ivory)', boxShadow: '0 0 0 2px var(--ks-turmeric), 0 6px 16px rgba(19,42,69,0.15)',
              }}
            >
              👤
            </div>
          )}
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--ks-earth)', marginBottom: 4 }}>{profile.name}</h1>
          {profile.business_name && <p style={{ fontSize: 15, color: 'var(--ks-clay)', fontWeight: 700, marginBottom: 6 }}>{profile.business_name}</p>}
          {(profile.craft_type || profile.state) && (
            <p style={{ fontSize: 13, color: 'var(--ks-muted)' }}>{[profile.craft_type, profile.state].filter(Boolean).join(' · ')}</p>
          )}
          {profile.languages_known && profile.languages_known.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--ks-muted)', marginTop: 4 }}>
              {t('publicPage.speaks')}: {profile.languages_known.map((id) => LANGUAGES.find((l) => l.id === id)?.name ?? id).join(', ')}
            </p>
          )}
        </div>

        <div className="ks-frieze" style={{ marginBottom: 24 }} />

        {profile.about && (
          <div style={{
            background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 16,
            padding: '20px 22px', marginBottom: 26, position: 'relative',
          }}>
            <p style={{ fontSize: 14.5, lineHeight: 1.75, color: 'var(--ks-earth)', fontStyle: 'italic' }}>&ldquo;{profile.about}&rdquo;</p>
          </div>
        )}

        {achievements.length > 0 && (
          <>
            <p style={sectionLabel}>{t('publicPage.recognition')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {achievements.map((a) => (
                <div key={a.id} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--ks-ivory)',
                  border: '1px solid var(--ks-border)', borderRadius: 12, padding: '12px 14px',
                }}>
                  <span
                    aria-hidden="true"
                    style={{
                      width: 30, height: 30, borderRadius: '50%', background: 'rgba(15,91,78,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0,
                    }}
                  >
                    🏆
                  </span>
                  <p style={{ fontSize: 13.5, color: 'var(--ks-earth)', lineHeight: 1.5, paddingTop: 2 }}>
                    <strong>{a.title}</strong>{a.year ? ` (${a.year})` : ''}{a.issuing_organization ? ` · ${a.issuing_organization}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}

        {products.length > 0 && (
          <>
            <p style={sectionLabel}>{t('publicPage.myWork')}</p>
            <div className="ks-product-grid" style={{ display: 'grid', gap: 14, marginBottom: 24 }}>
              {products.map((p) => (
                <a
                  key={p.id}
                  href={`/a/${slug}/p/${p.id}`}
                  aria-label={`${t('publicPage.viewProduct')}: ${p.name}`}
                  className="ks-product-card"
                  style={{
                    background: 'var(--ks-ivory)', border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', borderRadius: 14, overflow: 'hidden',
                    display: 'block', textDecoration: 'none', minHeight: 44,
                  }}
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} style={{ width: '100%', height: 150, objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: 150, background: 'var(--ks-linen)' }} />
                  )}
                  <div style={{ padding: 13 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ks-earth)' }}>{p.name}</div>
                    {p.craft_type && <div style={{ fontSize: 11.5, color: 'var(--ks-muted)', marginTop: 2 }}>{p.craft_type}</div>}
                    {p.description && (
                      <p style={{ fontSize: 12, color: 'var(--ks-earth)', marginTop: 7, lineHeight: 1.55 }}>
                        {p.description.slice(0, 120)}{p.description.length > 120 ? '…' : ''}
                      </p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </>
        )}

        {hasWhatsApp && (
          <div className="ks-whatsapp-inline" style={{ textAlign: 'center', marginTop: 32 }}>
            <a
              href={`https://wa.me/${profile.public_contact_phone!.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9, background: 'var(--ks-jade)', color: '#fff',
                textDecoration: 'none', borderRadius: 999, padding: '15px 32px', fontSize: 15, fontWeight: 700,
                boxShadow: '0 6px 18px rgba(15,91,78,0.3)',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: 17 }}>💬</span> {t('publicPage.enquireWhatsapp')}
            </a>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--ks-muted)', marginTop: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <PeacockMark size={13} />
          {t('publicPage.madeWith')}
        </p>
      </div>

      {hasWhatsApp && (
        <a
          href={`https://wa.me/${profile.public_contact_phone!.replace(/[^0-9]/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ks-whatsapp-sticky"
          style={{
            display: 'none', alignItems: 'center', justifyContent: 'center', gap: 9,
            // bottom: 76 clears the app's persistent bottom NavBar (~60px tall,
            // rendered on every route including this public one) so the two
            // don't overlap.
            position: 'fixed', left: 16, right: 16, bottom: 76, zIndex: 90,
            background: 'var(--ks-jade)', color: '#fff', textDecoration: 'none',
            borderRadius: 999, padding: '15px 20px', fontSize: 15, fontWeight: 700,
            boxShadow: '0 8px 24px rgba(19,42,69,0.35)',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 17 }}>💬</span> {t('publicPage.enquireWhatsapp')}
        </a>
      )}

      <style jsx>{`
        .ks-product-grid {
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        }
        @media (hover: hover) {
          .ks-product-card {
            transition: transform 0.18s ease, box-shadow 0.18s ease;
          }
          .ks-product-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 22px rgba(19, 42, 69, 0.12);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ks-product-card {
            transition: none !important;
          }
        }
        @media (max-width: 480px) {
          .ks-product-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
        }
        @media (max-width: 640px) {
          .ks-whatsapp-sticky {
            display: flex !important;
          }
          .ks-whatsapp-inline {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}

const sectionLabel: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--ks-muted)',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12,
}
