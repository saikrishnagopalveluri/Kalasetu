import { notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BlogDetailView, { type Blog } from './BlogDetailView'
import { BRAND } from '@/lib/brand'
import { applyBrandToText } from '@/lib/applyBrand'
import { BLOG_AUTHOR } from '@/lib/blogAuthor'

export const revalidate = 3600

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || BRAND.fallbackUrl

async function getPost(slug: string): Promise<(Blog & { created_at: string }) | null> {
  if (!supabase) return null
  const { data } = await supabase.from('blogs').select('slug, title, content, category, created_at, image_url, image_credit').eq('slug', slug).maybeSingle()
  if (!data) return null
  // Older posts may still hold a literal brand name baked in from whichever
  // deployment originally generated them (both brands share one database) —
  // resolved to the viewing domain's own brand at render time.
  return { ...data, title: applyBrandToText(data.title), content: applyBrandToText(data.content) }
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  // Article schema per Google's own gen-AI guidance: standard Article
  // structured data with author + Organization entities is what AI
  // Overviews and AI Mode actually look for — there's no separate schema
  // for "AI SEO". Author is the brand's own organization, not an invented
  // named persona, since these posts aren't bylined to a person.
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.content.slice(0, 155),
    articleSection: post.category,
    datePublished: post.created_at,
    dateModified: post.created_at,
    ...(post.image_url ? { image: post.image_url } : {}),
    author: { '@type': 'Person', name: BLOG_AUTHOR },
    publisher: {
      '@type': 'Organization',
      name: BRAND.name,
      logo: { '@type': 'ImageObject', url: `${BASE_URL}/apple-touch-icon.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${BASE_URL}/blog/${post.slug}` },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <BlogDetailView post={post} />
    </>
  )
}
