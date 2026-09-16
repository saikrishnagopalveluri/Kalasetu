import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Privacy Policy | ${BRAND.name}`,
  description: `How ${BRAND.name} collects, uses, and protects artisan data, including which third-party services process it.`,
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children
}
