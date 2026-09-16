import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `My Catalogue | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function CatalogueManageLayout({ children }: { children: React.ReactNode }) {
  return children
}
