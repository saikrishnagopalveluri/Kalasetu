import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `KalaWallet | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return children
}
