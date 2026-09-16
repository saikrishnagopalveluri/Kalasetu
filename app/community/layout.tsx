import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Artisan Stories & Community | ${BRAND.name}`,
  description: 'Real stories from Indian artisans — their craft, their village, their business journey — written by the artisans themselves.',
  openGraph: {
    title: `Artisan Stories & Community | ${BRAND.name}`,
    description: 'Real stories from Indian artisans — their craft, their village, their business journey — written by the artisans themselves.',
  },
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children
}
