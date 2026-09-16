import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Create | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return children
}
