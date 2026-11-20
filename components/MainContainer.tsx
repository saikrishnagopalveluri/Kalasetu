'use client'

import { usePathname } from 'next/navigation'

// Every page gets the same narrow, phone-friendly column (800px) except the
// internal admin screens, which show data tables that genuinely need more
// horizontal room on desktop. Keeping this pathname check in one small
// client component (instead of making the whole root layout client-side)
// is what lets the rest of the app stay a plain, fast server-rendered shell.
export default function MainContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin')

  return (
    // id + tabIndex let the "Skip to main content" link move focus here.
    <main id="main-content" tabIndex={-1} style={{
      outline: 'none',
      maxWidth: isAdmin ? 1100 : 800,
      margin: '0 auto',
      padding: '24px 20px calc(100px + env(safe-area-inset-bottom))',
    }}>
      {children}
    </main>
  )
}
