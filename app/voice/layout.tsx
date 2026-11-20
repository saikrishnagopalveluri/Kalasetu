import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Saathi Voice | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function VoiceLayout({ children }: { children: React.ReactNode }) {
  return children
}
