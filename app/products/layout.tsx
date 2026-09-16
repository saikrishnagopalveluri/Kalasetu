import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `My Products | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return children
}
