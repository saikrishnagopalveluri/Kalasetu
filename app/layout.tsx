import Link from 'next/link'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import HeaderAuthStatus from '@/components/HeaderAuthStatus'
import { AuthProvider } from '@/lib/AuthProvider'
import { LanguageProvider } from '@/lib/LanguageProvider'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import LanguageGate from '@/components/LanguageGate'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import NavBar from '@/components/NavBar'
import HeaderTagline from '@/components/HeaderTagline'
import { AskAIProvider } from '@/lib/AskAIProvider'
import AskAIModal from '@/components/AskAIModal'
import MainContainer from '@/components/MainContainer'
import PeacockMark from '@/components/PeacockMark'
import { BRAND } from '@/lib/brand'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || BRAND.fallbackUrl

export const metadata: Metadata = {
  title: `${BRAND.name} | AI Creative Studio`,
  description: `${BRAND.name} helps artisans across India take their craft business online: fair prices, good product photos and listings in their own language. Practical digital skills for traditional handicrafts, without the jargon.`,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: BRAND.name,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#132A45',
  // Lets content draw under the notch/home-indicator safe areas instead of
  // just leaving them blank, so the fixed header/nav (below) can pad
  // themselves out to the real edge with env(safe-area-inset-*) rather than
  // stopping short of it, which matters most in standalone PWA mode on iOS.
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Organization entity, established once site-wide — per Google's own
  // gen-AI guidance, this plus per-page Article schema (see app/blog) is
  // what AI Overviews/AI Mode actually use, not a separate "AI SEO" schema.
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND.name,
    url: BASE_URL,
    logo: `${BASE_URL}/apple-touch-icon.png`,
    description: 'Simple tools that help traditional Indian artisans price their work, photograph it, market it and run their business in their own language.',
  }

  return (
    <html lang="en">
      <body>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <ServiceWorkerRegister />
      <AuthProvider>
      <LanguageProvider>
      <AskAIProvider>
      <LanguageGate />
      <AskAIModal />

        {/* ── Header ─────────────────────────────────────── */}
        <header style={{
          background: 'var(--ks-earth)',
          padding: 'calc(12px + env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) 12px max(20px, env(safe-area-inset-left))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          position: 'sticky',
          top: 0,
          zIndex: 100,
          // Safety net: if content still can't fit on a very narrow phone
          // (~320px), it scrolls horizontally within the header instead of
          // silently clipping the login link off-screen.
          overflowX: 'auto',
        }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
            <div style={{
              width: 51,
              height: 36,
              borderRadius: 9,
              background: '#F9E9D6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            }}>
              <PeacockMark size={36} />
            </div>
            <div>
              <div style={{
                color: '#fff',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 18,
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}>
                {BRAND.name}
              </div>
              <HeaderTagline />
            </div>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <LanguageSwitcher />
            <HeaderAuthStatus />
          </div>
        </header>
        <div className="ks-zari-band" />

        {/* ── Main content ───────────────────────────────── */}
        <MainContainer>{children}</MainContainer>

        <NavBar />

      </AskAIProvider>
      </LanguageProvider>
      </AuthProvider>
      </body>
    </html>
  )
}