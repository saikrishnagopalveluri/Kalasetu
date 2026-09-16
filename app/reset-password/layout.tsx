import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Reset password | ${BRAND.name}`,
  robots: { index: false, follow: true },
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
