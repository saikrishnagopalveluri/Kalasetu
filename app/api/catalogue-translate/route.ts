import { NextRequest, NextResponse } from 'next/server'
import { readJsonObject } from '@/lib/readJson'
import { requireUser } from '@/lib/requireUser'
import { isRateLimited, userKey } from '@/lib/rateLimit'
import { isGeminiConfigured } from '@/lib/gemini'
import { languageName } from '@/lib/languages'
import { sanitizeProducts, translateCatalogueProducts } from '@/lib/catalogueTranslate'

export const maxDuration = 60

// Translates the artisan's product details into the catalogue's language.
// On any failure the page keeps the original text and says so, so this
// returns a generic 503 rather than an error the artisan cannot act on.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }
    if (isRateLimited(userKey(`catalogue-translate:${auth.userId ?? 'anonymous'}`), 10, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    const body = await readJsonObject(request)
    const products = sanitizeProducts(body.products)
    if (!products || typeof body.language !== 'string' || !languageName(body.language)) {
      return NextResponse.json({ error: 'Products and a supported language are required' }, { status: 400 })
    }
    if (body.language === 'en') {
      return NextResponse.json({ products, translated: false })
    }
    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: 'Translation unavailable' }, { status: 503 })
    }
    return NextResponse.json(await translateCatalogueProducts(products, body.language))
  } catch (error) {
    console.error('Catalogue translate route error:', error)
    return NextResponse.json({ error: 'Translation unavailable' }, { status: 503 })
  }
}
