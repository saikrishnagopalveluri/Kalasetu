import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Terms & Conditions | ${BRAND.name}`,
  description: `The terms governing use of ${BRAND.name}, including subscription billing and account rules.`,
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children
}
