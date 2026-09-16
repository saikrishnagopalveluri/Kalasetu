import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { supabase } from '@/lib/supabase'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { data } = await supabase
    ? await supabase!.from('public_artisan_catalogues').select('name, business_name, about, craft_type').eq('public_slug', slug).maybeSingle()
    : { data: null }

  if (!data) return { title: `Artisan page not found | ${BRAND.name}` }

  const displayName = data.business_name || data.name
  const title = `${displayName} | ${BRAND.name}`
  const description = data.about?.slice(0, 155) || `${displayName}'s handcrafted ${data.craft_type || 'products'}, made in India. View the full catalogue on ${BRAND.name}.`

  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default function ArtisanLayout({ children }: { children: React.ReactNode }) {
  return children
}
