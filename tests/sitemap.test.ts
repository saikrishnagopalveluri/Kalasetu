import { describe, it, expect, vi, beforeEach } from 'vitest'

// sitemap.ts decides what search engines and AI crawlers discover about the
// site. Two failure modes matter here: silently returning nothing useful
// when Supabase is unreachable (staticEntries fallback), and constructing a
// malformed URL for a dynamic entry (broken sitemap = pages never indexed).

function fromBuilder(rows: Record<string, unknown[]>) {
  return {
    from: (table: string) => ({
      select: () => {
        const data = rows[table] ?? []
        // catalogues query chains an extra .eq('published', true) — make
        // that a no-op pass-through so the same builder shape works for
        // every table this file queries.
        const chain = { data, eq: () => chain }
        return chain
      },
    }),
  }
}

describe('sitemap.ts', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('falls back to just the static routes when Supabase is not configured', async () => {
    vi.doMock('@/lib/supabase', () => ({ supabase: null }))
    const { default: sitemap } = await import('@/app/sitemap')
    const entries = await sitemap()

    expect(entries.length).toBeGreaterThan(0)
    expect(entries.every((e) => e.url.startsWith('https://'))).toBe(true)
    expect(entries.map((e) => e.url).some((u) => u.endsWith('/blog'))).toBe(true)
  })

  it('includes dynamic artisan, catalogue, and blog entries when data exists', async () => {
    vi.doMock('@/lib/supabase', () => ({
      supabase: fromBuilder({
        public_artisan_catalogues: [{ public_slug: 'meera-textiles' }],
        catalogues: [{ slug: 'festival-collection', updated_at: '2026-01-01T00:00:00Z' }],
        blogs: [{ slug: 'how-hastkatha-writes-descriptions', created_at: '2026-02-01T00:00:00Z' }],
      }),
    }))
    const { default: sitemap } = await import('@/app/sitemap')
    const entries = await sitemap()
    const urls = entries.map((e) => e.url)

    expect(urls.some((u) => u.endsWith('/a/meera-textiles'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/c/festival-collection'))).toBe(true)
    expect(urls.some((u) => u.endsWith('/blog/how-hastkatha-writes-descriptions'))).toBe(true)
  })

  it('never emits a malformed URL (no double slashes, no undefined/null segments)', async () => {
    vi.doMock('@/lib/supabase', () => ({
      supabase: fromBuilder({
        public_artisan_catalogues: [{ public_slug: 'a-slug' }],
        catalogues: [{ slug: 'c-slug', updated_at: null }],
        blogs: [{ slug: 'b-slug', created_at: null }],
      }),
    }))
    const { default: sitemap } = await import('@/app/sitemap')
    const entries = await sitemap()

    for (const entry of entries) {
      expect(entry.url).not.toMatch(/undefined|null/)
      expect(entry.url).not.toMatch(/[^:]\/\//) // double slash, excluding the https:// scheme
    }
  })
})
