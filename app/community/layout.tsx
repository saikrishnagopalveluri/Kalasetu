import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Artisan Stories & Community | ${BRAND.name}`,
  description: 'Stories written by Indian artisans themselves: their craft, their village and how their business grew.',
  openGraph: {
    title: `Artisan Stories & Community | ${BRAND.name}`,
    description: 'Stories written by Indian artisans themselves: their craft, their village and how their business grew.',
  },
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children
}
