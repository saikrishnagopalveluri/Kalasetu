import { supabase } from '@/lib/supabase'
import BlogListView, { type BlogSummary } from './BlogListView'

// Server-rendered on purpose: the post list used to be fetched client-side
// (useEffect + Supabase), which meant crawlers that don't reliably execute
// JavaScript (several AI crawlers, in particular) saw an empty "Loading…"
// shell instead of any post titles. Fetching here means every post's
// English title/summary is present in the initial HTML response.
export const revalidate = 3600

async function getPosts(): Promise<BlogSummary[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('blogs')
    .select('slug, title, summary, category, created_at, image_url')
    .order('created_at', { ascending: false })
  return data ?? []
}

export default async function BlogListPage() {
  const posts = await getPosts()
  return <BlogListView posts={posts} />
}
