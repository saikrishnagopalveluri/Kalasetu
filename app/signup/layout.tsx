import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Sign up free | ${BRAND.name}`,
  description: `Create your free ${BRAND.name} account. No credit card required — AI-powered photos, pricing, and marketing for Indian artisans.`,
}

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children
}
