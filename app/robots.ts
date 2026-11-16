import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/brand'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || BRAND.fallbackUrl

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Everything behind RequireAuth is a private workspace, not content
      // meant to be indexed — no reason to let crawlers spend budget on it.
      // /blog is deliberately NOT in this list — it's public and
      // server-rendered specifically so it can be indexed.
      disallow: [
        '/studio', '/products', '/design', '/calculator', '/content',
        '/profile', '/promote', '/coach', '/catalogue', '/opportunities',
        '/admin', '/api',
        '/create', '/upskill', '/wallet', '/saathi',
        // Still gated behind RequireAuth — see the /blog un-gating for what
        // it'd take to lift this too.
        '/pricing',
      ],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
