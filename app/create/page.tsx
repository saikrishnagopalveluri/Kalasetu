'use client'

import RequireAuth from '@/components/RequireAuth'
import { useLanguage } from '@/lib/LanguageProvider'
import type { TranslationKey } from '@/lib/translations'
import {
  IconProducts, IconStudio, IconContent, IconDesign, IconPromote, IconCatalogue, IconContent as IconStory, IconSaathi,
} from '@/components/CraftIcons'

type CreateCard = { Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; titleKey: TranslationKey; descKey: TranslationKey; href: string; accent: string; isModal?: boolean }

const CARDS: CreateCard[] = [
  { Icon: IconProducts, titleKey: 'create.products.title', descKey: 'create.products.desc', href: '/products', accent: '#132A45' },
  { Icon: IconStudio,   titleKey: 'create.studio.title',   descKey: 'create.studio.desc',   href: '/studio',   accent: '#C4552D' },
  { Icon: IconContent,  titleKey: 'create.content.title',  descKey: 'create.content.desc',  href: '/content',  accent: '#0F5B4E' },
  { Icon: IconDesign,   titleKey: 'create.design.title',   descKey: 'create.design.desc',   href: '/design',   accent: '#132A45' },
  { Icon: IconPromote,  titleKey: 'create.promote.title',  descKey: 'create.promote.desc',  href: '/promote',  accent: '#D4A017' },
  { Icon: IconCatalogue, titleKey: 'create.catalogue.title', descKey: 'create.catalogue.desc', href: '/catalogue', accent: '#D4A017' },
  { Icon: IconStory,    titleKey: 'create.story.title',    descKey: 'create.story.desc',    href: '/community/new', accent: '#C4552D' },
  { Icon: IconSaathi,   titleKey: 'saathi.ctaTitle',       descKey: 'saathi.ctaDesc',        href: '/saathi',    accent: '#C4552D' },
]

function CreateHubInner() {
  const { t } = useLanguage()
  return (
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 5vw, 27px)', color: 'var(--ks-earth)', marginBottom: 6 }}>
        {t('create.title')}
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--ks-muted)', marginBottom: 14, lineHeight: 1.6, maxWidth: 520 }}>
        {t('create.subtitle')}
      </p>
      <div className="ks-frieze" style={{ marginBottom: 22 }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {CARDS.map((card) => (
          <a
            key={card.titleKey}
            id={card.href === '/products' ? 'tour-nav-products' : card.href === '/studio' ? 'tour-nav-studio' : card.href === '/content' ? 'tour-nav-content' : undefined}
            href={card.href}
            style={{
              display: 'block', background: 'var(--ks-ivory)', borderRadius: 14, padding: '18px 14px',
              border: '1px solid var(--ks-border)', boxShadow: '0 2px 8px rgba(19,42,69,0.05)', textDecoration: 'none',
            }}
          >
            <div style={{
              width: 42, height: 42, borderRadius: 11, background: `${card.accent}18`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            }}>
              <card.Icon size={21} style={{ color: card.accent }} />
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13.5, color: 'var(--ks-earth)', marginBottom: 4 }}>
              {t(card.titleKey)}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ks-muted)', lineHeight: 1.4 }}>
              {t(card.descKey)}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

export default function CreateHubPage() {
  return (
    <RequireAuth>
      <CreateHubInner />
    </RequireAuth>
  )
}
