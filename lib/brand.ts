// This codebase and database are shared by two separately-deployed brands.
// Each Vercel project sets NEXT_PUBLIC_BRAND to pick which one it renders as
// — see the "Multi-brand deployment" section in README.md. It is a
// NEXT_PUBLIC_ var specifically so each project's own build bakes in its own
// value; nothing here depends on the request host.
//
// hello@kalasetu.in is deliberately NOT used anywhere, for either brand:
// kalasetu.in is a real, unrelated business's live domain (see AGENTS.md /
// the AI Build Log), not ours. Both brands share the one working support
// address, hello@hastkatha.in, until each has its own real domain and inbox.

export type BrandId = 'kalasetu' | 'hastkatha'

type BrandConfig = {
  name: string
  fallbackUrl: string
  supportEmail: string
}

const BRANDS: Record<BrandId, BrandConfig> = {
  kalasetu: {
    name: 'KalaSetu',
    fallbackUrl: 'https://kalasetu-six.vercel.app',
    supportEmail: 'hello@hastkatha.in',
  },
  hastkatha: {
    name: 'Hastkatha',
    fallbackUrl: 'https://hastkatha.vercel.app',
    supportEmail: 'hello@hastkatha.in',
  },
}

function resolveBrandId(): BrandId {
  const raw = process.env.NEXT_PUBLIC_BRAND
  return raw === 'kalasetu' ? 'kalasetu' : 'hastkatha'
}

export const BRAND_ID: BrandId = resolveBrandId()
export const BRAND: BrandConfig = BRANDS[BRAND_ID]
