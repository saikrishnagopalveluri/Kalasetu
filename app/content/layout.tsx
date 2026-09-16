import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Content | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  return children
}
