import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Sign up free | ${BRAND.name}`,
  description: `Create your free ${BRAND.name} account, no card needed. Get product photos, fair prices and marketing help for your craft.`,
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
