import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Design Studio | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return children
}
