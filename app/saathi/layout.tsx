import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `${BRAND.name} Saathi`,
  robots: { index: false, follow: false },
}

export default function SaathiLayout({ children }: { children: React.ReactNode }) {
  return children
}
