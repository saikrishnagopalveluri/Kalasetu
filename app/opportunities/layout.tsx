import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Opportunities | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function OpportunitiesLayout({ children }: { children: React.ReactNode }) {
  return children
}
