import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

// Currently gated behind <RequireAuth> — noindexed because crawlers hit a
// login redirect instead of the pricing content. Revisit if that gating
// is lifted (see the /pricing auth-gating flag raised separately).
export const metadata: Metadata = {
  title: `Pricing | ${BRAND.name}`,
  robots: { index: false, follow: false },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
