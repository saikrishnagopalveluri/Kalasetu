import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Forgot password | ${BRAND.name}`,
  robots: { index: false, follow: true },
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
