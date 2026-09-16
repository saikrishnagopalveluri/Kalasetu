'use client'

import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/LanguageProvider'
import { useAskAI } from '@/lib/AskAIProvider'
import type { TranslationKey } from '@/lib/translations'
import { IconHome, IconCreate, IconCommunity, IconUpskill, IconProfileNav, IconCoach } from '@/components/CraftIcons'

type NavIcon = React.ComponentType<{ size?: number; style?: React.CSSProperties }>

const NAV_ITEMS: { href: string; Icon: NavIcon; key: TranslationKey; id?: string }[] = [
  { href: '/',          Icon: IconHome,       key: 'nav.home',      },
  { href: '/create',    Icon: IconCreate,     key: 'nav.create',    id: 'tour-nav-create'  },
  { href: '/community', Icon: IconCommunity,  key: 'nav.community', id: 'tour-nav-community' },
  { href: '/upskill',   Icon: IconUpskill,    key: 'nav.upskill',   id: 'tour-nav-upskill' },
  { href: '/profile',   Icon: IconProfileNav, key: 'nav.profile',   id: 'tour-nav-profile' },
]

function itemStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    padding: '4px 0', textDecoration: 'none', color: active ? 'var(--ks-turmeric)' : 'rgba(255,255,255,0.45)',
    fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: active ? 700 : 500, transition: 'color 0.15s',
    background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative',
  }
}

// A small dot beneath the active tab — the mark drawn at a threshold,
// standing in for a plain colour change to say "you are here."
function ActiveDot() {
  return (
    <span aria-hidden="true" style={{
      position: 'absolute', bottom: 0, width: 4, height: 4, borderRadius: '50%', background: 'var(--ks-turmeric)',
    }} />
  )
}

export default function NavBar() {
  const { t } = useLanguage()
  const { open: openAskAI } = useAskAI()
  const pathname = usePathname()
  // "/" only matches the home route itself, everything else matches its own
  // path plus any sub-routes under it (e.g. /products/abc123 keeps Products
  // highlighted), so the active tab stays correct on nested pages too.
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname?.startsWith(href)

  return (
    <>
      <button
        id="tour-nav-coach"
        onClick={openAskAI}
        aria-label={t('nav.coach')}
        style={{
          position: 'fixed', right: 16, bottom: 'calc(76px + env(safe-area-inset-bottom))', zIndex: 101,
          width: 52, height: 52, borderRadius: '50%', background: 'var(--ks-turmeric)', color: 'var(--ks-earth)',
          border: 'none', boxShadow: '0 6px 18px rgba(19,42,69,0.35)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        <IconCoach size={24} />
      </button>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--ks-earth)', borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '8px 0 calc(12px + env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'center', zIndex: 100,
      }}>
        <div style={{ display: 'flex', maxWidth: 800, width: '100%' }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            return (
              <a key={item.href} id={item.id} href={item.href} aria-current={active ? 'page' : undefined} style={itemStyle(active)}>
                <item.Icon size={20} style={{ opacity: active ? 1 : 0.7 }} />
                {t(item.key)}
                {active && <ActiveDot />}
              </a>
            )
          })}
        </div>
      </nav>
    </>
  )
}
