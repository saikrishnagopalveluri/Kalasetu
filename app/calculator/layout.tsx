import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Pricing Calculator | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return children
}
