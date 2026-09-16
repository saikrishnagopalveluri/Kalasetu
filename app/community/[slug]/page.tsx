import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import CommunityDetailView, { type Story } from './CommunityDetailView'

export const revalidate = 60

async function getStory(slug: string): Promise<Story | null> {
  if (!supabase) return null
  const { data: story } = await supabase
    .from('stories')
    .select('id, slug, title, content, category, language, reading_time_minutes, likes_count, rating_sum, rating_count, published_at, author_id')
    .eq('slug', slug).eq('status', 'PUBLISHED').maybeSingle()
  if (!story) return null
  const { data: author } = await supabase
    .from('artisan_profiles').select('name, business_name, profile_photo_url, public_slug').eq('id', story.author_id).maybeSingle()
  return { ...story, author_name: author?.name ?? null, author_business_name: author?.business_name ?? null, author_photo_url: author?.profile_photo_url ?? null, author_public_slug: author?.public_slug ?? null }
}

export default async function CommunityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const story = await getStory(slug)
  if (!story) notFound()
  return <CommunityDetailView story={story} />
}
