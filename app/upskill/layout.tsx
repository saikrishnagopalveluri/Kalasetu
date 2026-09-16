import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `UpSkill Academy | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function UpSkillLayout({ children }: { children: React.ReactNode }) {
  return children
}
