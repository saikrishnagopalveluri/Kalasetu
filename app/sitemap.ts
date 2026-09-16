import type { MetadataRoute } from 'next'
import { supabase } from '@/lib/supabase'
import { BRAND } from '@/lib/brand'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || BRAND.fallbackUrl

// /pricing is deliberately left out here — it's still wrapped in
// <RequireAuth>, so a crawler hits a login redirect there, not content.
// /blog was in the same situation until it was un-gated and converted to a
// server-rendered page specifically so it could be indexed — see app/blog.
const STATIC_ROUTES = ['', '/privacy', '/terms', '/learn', '/blog']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: new Date(),
  }))

  if (!supabase) return staticEntries

  const [{ data: artisans }, { data: catalogues }, { data: blogs }] = await Promise.all([
    supabase.from('public_artisan_catalogues').select('public_slug'),
    supabase.from('catalogues').select('slug, updated_at').eq('published', true),
    supabase.from('blogs').select('slug, created_at'),
  ])

  const artisanEntries: MetadataRoute.Sitemap = (artisans ?? []).map((a) => ({
    url: `${BASE_URL}/a/${a.public_slug}`,
  }))

  const catalogueEntries: MetadataRoute.Sitemap = (catalogues ?? []).map((c) => ({
    url: `${BASE_URL}/c/${c.slug}`,
    lastModified: c.updated_at ? new Date(c.updated_at) : new Date(),
  }))

  const blogEntries: MetadataRoute.Sitemap = (blogs ?? []).map((b) => ({
    url: `${BASE_URL}/blog/${b.slug}`,
    lastModified: b.created_at ? new Date(b.created_at) : new Date(),
  }))

  return [...staticEntries, ...artisanEntries, ...catalogueEntries, ...blogEntries]
}
