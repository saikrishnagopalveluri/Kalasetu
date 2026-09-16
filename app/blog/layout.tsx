import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Artisan Business & Digital Skills Blog | ${BRAND.name}`,
  description: 'Practical guides on the digital transformation of artisans — pricing, marketing, AI tools, and government schemes for makers of traditional Indian handicrafts.',
  openGraph: {
    title: `Artisan Business & Digital Skills Blog | ${BRAND.name}`,
    description: 'Practical guides on the digital transformation of artisans — pricing, marketing, AI tools, and government schemes for makers of traditional Indian handicrafts.',
  },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children
}
