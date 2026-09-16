import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { supabase } from '@/lib/supabase'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data } = supabase
    ? await supabase.from('stories').select('title, content').eq('slug', slug).eq('status', 'PUBLISHED').maybeSingle()
    : { data: null }

  if (!data) return { title: `Story not found | ${BRAND.name}` }

  const title = `${data.title} | ${BRAND.name}`
  const description = data.content.slice(0, 155)
  return {
    title,
    description,
    openGraph: { title, description, type: 'article' },
  }
}

export default function StoryDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
