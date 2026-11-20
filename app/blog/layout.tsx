import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Artisan Business & Digital Skills Blog | ${BRAND.name}`,
  description: 'Plain, practical guides for Indian artisans: pricing your work, selling on WhatsApp and Instagram, using AI tools, and the government schemes worth applying for.',
  openGraph: {
    title: `Artisan Business & Digital Skills Blog | ${BRAND.name}`,
    description: 'Plain, practical guides for Indian artisans: pricing your work, selling on WhatsApp and Instagram, using AI tools, and the government schemes worth applying for.',
  },
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children
}
