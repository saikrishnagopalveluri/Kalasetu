'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLanguage } from '@/lib/LanguageProvider'
import { useAskAI } from '@/lib/AskAIProvider'
import { useAuth } from '@/lib/useAuth'
import { supabaseConfigured } from '@/lib/supabase'
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

export default function NavBar() {
  const { t } = useLanguage()
  const { open: openAskAI } = useAskAI()
  const pathname = usePathname()
  // "/" only matches the home route itself, everything else matches its own
  // path plus any sub-routes under it (e.g. /products/abc123 keeps Products
  // highlighted), so the active tab stays correct on nested pages too.
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname?.startsWith(href)
  const { user } = useAuth()

  // Every tab and the AI coach need an account, so signed-out visitors (on
  // the login page, a blog post...) get the header's "Log in" instead of a
  // bar of links that would all bounce them to /login.
  if (supabaseConfigured && !user) return null
  // On the coach page the floating button duplicated the page itself and sat
  // on top of its Send button.
  const showFab = !pathname?.startsWith('/coach')

  return (
    <>
      {showFab && <button
        id="tour-nav-coach"
        type="button"
        onClick={openAskAI}
        aria-label={t('nav.coach')}
        className="ks-fab"
      >
        <IconCoach size={24} />
      </button>}
      <nav className="ks-tabbar" aria-label="Main">
        <div id="tour-nav-bar" className="ks-tabbar-inner">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                id={item.id}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className="ks-tab"
                data-active={active || undefined}
              >
                <span className="ks-tab-icon">
                  <item.Icon size={20} />
                </span>
                {t(item.key)}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
