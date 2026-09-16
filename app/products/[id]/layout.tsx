import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Edit Product | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function ProductDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
