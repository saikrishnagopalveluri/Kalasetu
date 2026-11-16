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
  // The introduction video shown on the landing page. The video itself
  // carries its brand's name on screen, so it is only set for the brand it
  // was made for; the other brand's homepage simply has no video section.
  introVideo: { src: string; poster: string } | null
}

const BRANDS: Record<BrandId, BrandConfig> = {
  kalasetu: {
    name: 'KalaSetu',
    fallbackUrl: 'https://kalasetu-six.vercel.app',
    supportEmail: 'hello@hastkatha.in',
    introVideo: { src: '/intro-video.mp4', poster: '/intro-video-poster.jpg' },
  },
  hastkatha: {
    name: 'Hastkatha',
    fallbackUrl: 'https://hastkatha.vercel.app',
    supportEmail: 'hello@hastkatha.in',
    introVideo: null,
  },
}

function resolveBrandId(): BrandId {
  const raw = process.env.NEXT_PUBLIC_BRAND
  return raw === 'kalasetu' ? 'kalasetu' : 'hastkatha'
}

export const BRAND_ID: BrandId = resolveBrandId()
export const BRAND: BrandConfig = BRANDS[BRAND_ID]
