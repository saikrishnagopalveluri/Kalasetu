import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Write a Story | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function StoryComposerLayout({ children }: { children: React.ReactNode }) {
  return children
}
