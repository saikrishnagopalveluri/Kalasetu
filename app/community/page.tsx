import { supabase } from '@/lib/supabase'
import CommunityListView, { type StorySummary } from './CommunityListView'

export const revalidate = 60

async function getStories(): Promise<StorySummary[]> {
  if (!supabase) return []
  const { data: stories } = await supabase
    .from('stories')
    .select('id, slug, title, category, language, likes_count, rating_sum, rating_count, reading_time_minutes, published_at, author_id')
    .eq('status', 'PUBLISHED')
    .order('published_at', { ascending: false })
  if (!stories || stories.length === 0) return []

  // A plain follow-up query rather than an embedded join — keeps this
  // independent of guessing Supabase's auto-generated foreign-key
  // constraint name, matching how the rest of this codebase queries
  // related tables (see app/products/[id]/page.tsx and app/a/[slug]/page.tsx).
  const authorIds = [...new Set(stories.map((s) => s.author_id))]
  const { data: authors } = await supabase
    .from('artisan_profiles').select('id, name, profile_photo_url').in('id', authorIds)
  const authorById = new Map((authors ?? []).map((a) => [a.id, a]))

  return stories.map((s) => ({
    ...s,
    author_name: authorById.get(s.author_id)?.name ?? null,
    author_photo_url: authorById.get(s.author_id)?.profile_photo_url ?? null,
  }))
}

export default async function CommunityListPage() {
  const stories = await getStories()
  return <CommunityListView stories={stories} />
}
