import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { supabase } from '@/lib/supabase'

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productId: string }> }): Promise<Metadata> {
  const { productId } = await params
  const { data } = await supabase
    ? await supabase!.from('products').select('name, description, material, craft_type').eq('id', productId).maybeSingle()
    : { data: null }

  if (!data) return { title: `Product not found | ${BRAND.name}` }

  const title = `${data.name} | ${BRAND.name}`
  const description = data.description?.slice(0, 155)
    || `${data.name}${data.material ? `, made of ${data.material}` : ''} — a handcrafted ${data.craft_type || 'product'} from an independent Indian artisan.`

  return {
    title,
    description,
    openGraph: { title, description },
  }
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children
}
