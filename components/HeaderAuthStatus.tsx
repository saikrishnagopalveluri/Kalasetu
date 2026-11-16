'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/useAuth'
import { supabaseConfigured } from '@/lib/supabase'
import { useLanguage } from '@/lib/LanguageProvider'

export default function HeaderAuthStatus() {
  const { user, profile, logOut } = useAuth()
  const { t } = useLanguage()

  if (!supabaseConfigured) return null

  if (!user) {
    return (
      <Link
        href="/login"
        style={{
          color: 'var(--ks-turmeric)', fontSize: 12, fontWeight: 600,
          textDecoration: 'none', padding: '13px 10px', display: 'inline-flex', alignItems: 'center',
        }}
      >
        {t('header.login')}
      </Link>
    )
  }

  const initial = (profile?.name || user.email || '?').charAt(0).toUpperCase()

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {profile?.is_admin && (
        <Link href="/admin" style={{
          color: 'var(--ks-turmeric)', fontSize: 11, fontWeight: 600, textDecoration: 'none',
          padding: '13px 8px', display: 'inline-flex', alignItems: 'center',
        }}>
          {t('nav.admin')}
        </Link>
      )}
      {/* Avatar image stays visually 26px; the link's padding is what
          brings the actual tap target up toward the 44px minimum. */}
      <Link href="/profile" style={{ textDecoration: 'none', padding: 9, display: 'inline-flex' }}>
        {profile?.profile_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.profile_photo_url} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--ks-indigo)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>
            {initial}
          </div>
        )}
      </Link>
      <button
        onClick={async () => { await logOut(); window.location.href = '/login' }}
        style={{
          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)',
          fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-body)', padding: '13px 8px',
        }}
      >
        {t('header.logout')}
      </button>
    </div>
  )
}
