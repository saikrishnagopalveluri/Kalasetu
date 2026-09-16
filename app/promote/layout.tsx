import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Promote | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function PromoteLayout({ children }: { children: React.ReactNode }) {
  return children
}
