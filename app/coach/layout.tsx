import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `AI Coach | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return children
}
