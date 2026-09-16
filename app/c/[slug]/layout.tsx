import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { supabase } from '@/lib/supabase'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data } = await supabase
    ? await supabase!.from('catalogues').select('title, business_name').eq('slug', slug).eq('published', true).maybeSingle()
    : { data: null }

  if (!data) return { title: `Catalogue not found | ${BRAND.name}` }

  const title = `${data.title} | ${data.business_name} | ${BRAND.name}`
  const description = `Browse ${data.business_name}'s product catalogue, handcrafted in India. Shared via ${BRAND.name}.`

  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default function CatalogueLayout({ children }: { children: React.ReactNode }) {
  return children
}
