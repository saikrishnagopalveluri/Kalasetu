import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Learn | ${BRAND.name}`,
  description: 'Free lessons for Indian artisans on pricing, PM Vishwakarma, WhatsApp marketing, product descriptions, Instagram, and protecting your craft.',
}

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return children
}
