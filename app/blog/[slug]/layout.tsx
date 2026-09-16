import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { supabase } from '@/lib/supabase'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data } = supabase
    ? await supabase.from('blogs').select('title, summary').eq('slug', slug).maybeSingle()
    : { data: null }

  if (!data) return { title: `Post not found | ${BRAND.name}` }

  const title = `${data.title} | ${BRAND.name}`
  return {
    title,
    description: data.summary,
    openGraph: { title, description: data.summary, type: 'article' },
  }
}

export default function BlogPostLayout({ children }: { children: React.ReactNode }) {
  return children
}
