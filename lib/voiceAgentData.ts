import { supabaseAdmin } from './supabaseAdmin'
import { BRAND } from './brand'
import type { AgentDataSource, SchemeItem } from './voiceAgent'

// Server-only data access for the voice agent's tools. Every query is
// scoped to the caller's own user id (or to public scheme listings); the
// agent itself never sees the database client.

function cleanKeyword(keyword: string | null): string | null {
  // Only letters, digits and spaces reach the PostgREST filter string.
  const cleaned = keyword?.replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 30)
  return cleaned || null
}

export function createDataSource(userId: string | null): AgentDataSource {
  const db = supabaseAdmin
  return {
    async findSchemes(keyword, type) {
      if (!db) return []
      const today = new Date().toISOString().slice(0, 10)
      const run = async (kw: string | null) => {
        let query = db
          .from('opportunities')
          .select('title, type, deadline, official_url')
          .or(`deadline.is.null,deadline.gte.${today}`)
        if (type) query = query.eq('type', type)
        if (kw) query = query.or(`title.ilike.%${kw}%,description.ilike.%${kw}%`)
        const { data, error } = await query.order('deadline', { ascending: true, nullsFirst: false }).limit(5)
        if (error) throw new Error(error.message)
        return (data ?? []).map((row): SchemeItem => ({
          title: String(row.title), type: String(row.type), deadline: row.deadline ?? null, url: String(row.official_url),
        }))
      }
      const kw = cleanKeyword(keyword)
      const matches = await run(kw)
      // A keyword the listings never use should not hide every open scheme.
      return matches.length > 0 || !kw ? matches : run(null)
    },
    async listProducts() {
      if (!db || !userId) return { total: 0, items: [] }
      const { data, count, error } = await db
        .from('products')
        .select('name, material, description', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(15)
      if (error) throw new Error(error.message)
      return {
        total: count ?? data?.length ?? 0,
        items: (data ?? []).map((p) => ({ name: String(p.name), material: p.material ?? null, hasListing: Boolean(p.description) })),
      }
    },
    async getProfile() {
      if (!db || !userId) return null
      const { data, error } = await db
        .from('artisan_profiles')
        .select('name, craft_type, state, public_slug, catalogue_published')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return null
      const base = (process.env.NEXT_PUBLIC_APP_URL || BRAND.fallbackUrl).replace(/\/+$/, '')
      return {
        name: data.name ?? null,
        craft: data.craft_type ?? null,
        state: data.state ?? null,
        catalogueUrl: data.catalogue_published && data.public_slug ? `${base}/a/${data.public_slug}` : null,
      }
    },
  }
}
