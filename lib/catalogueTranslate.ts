// Translates the artisan's own product details (name, material, craft,
// description, craft story) into the language a catalogue is being made
// in, with one structured Gemini call for the whole catalogue.
//
// The result is validated field by field: anything missing, empty or not
// a string keeps the artisan's original text, so a bad answer can never
// blank out or invent a product.

import Groq from 'groq-sdk'
import { geminiText, GEMINI_MODELS } from './gemini'
import { languageName } from './languages'

// Gemini first (two fast models), then Groq, each with its own time limit
// so the whole job stays inside the route's 60 s. Without a backup, a busy
// Gemini quietly left the whole catalogue in English.
const CATALOGUE_GEMINI_MODELS = () => [...new Set([GEMINI_MODELS.fast, 'gemini-3.5-flash-lite'])]
const GEMINI_ATTEMPT_MS = 18_000
const GROQ_MODEL = 'openai/gpt-oss-120b'
const GROQ_ATTEMPT_MS = 20_000

function parseList(text: string): unknown[] {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const parsed: unknown = JSON.parse(cleaned)
  const list = Array.isArray(parsed) ? parsed : (parsed as { products?: unknown })?.products
  if (!Array.isArray(list)) throw new Error('catalogueTranslate: response is not a list')
  return list
}

async function translateWithFallback(prompt: string): Promise<unknown[]> {
  let lastError: unknown
  for (const model of CATALOGUE_GEMINI_MODELS()) {
    try {
      const { text } = await geminiText({ prompt, json: true, maxTokens: 8192, timeoutMs: GEMINI_ATTEMPT_MS, model })
      return parseList(text)
    } catch (err) {
      lastError = err
      console.error(`catalogueTranslate: ${model} failed:`, err instanceof Error ? err.message : err)
    }
  }
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw lastError
  const res = await new Groq({ apiKey }).chat.completions.create(
    { model: GROQ_MODEL, messages: [{ role: 'user', content: prompt }], max_tokens: 8192 },
    { timeout: GROQ_ATTEMPT_MS },
  )
  return parseList(res.choices[0]?.message?.content ?? '')
}

export const MAX_CATALOGUE_PRODUCTS = 40
const FIELDS = ['name', 'material', 'craft_type', 'description', 'craft_story'] as const
type Field = typeof FIELDS[number]

export type TranslatableProduct = { id: string } & { [K in Field]?: string | null }

export function sanitizeProducts(value: unknown): TranslatableProduct[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_CATALOGUE_PRODUCTS) return null
  const out: TranslatableProduct[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof (item as { id?: unknown }).id !== 'string') return null
    const src = item as Record<string, unknown>
    const product: TranslatableProduct = { id: String(src.id).slice(0, 100) }
    for (const field of FIELDS) {
      const v = src[field]
      product[field] = typeof v === 'string' ? v.slice(0, 3000) : null
    }
    out.push(product)
  }
  return out
}

export async function translateCatalogueProducts(products: TranslatableProduct[], language: string): Promise<{ products: TranslatableProduct[]; translated: boolean }> {
  const target = languageName(language)
  if (!target || language === 'en') return { products, translated: false }

  // Only the fields that actually have text are sent.
  const payload = products.map((p) => {
    const entry: Record<string, string> = { id: p.id }
    for (const field of FIELDS) if (p[field]) entry[field] = p[field] as string
    return entry
  })

  const prompt = `Translate these handmade product listings from an Indian artisan's catalogue into ${target}, in its standard script.
Write naturally for buyers, the way a person from that region would describe these products. Keep craft names that are proper names recognisable (for example Pochampally, Kalamkari, Channapatna), transliterating them into the script. Keep numbers and measurements. Do not add, remove or invent any detail.
Return ONLY a JSON array with one object per product, the same "id" values, and the same fields translated.

${JSON.stringify(payload)}`

  const list = await translateWithFallback(prompt)

  const byId = new Map<string, Record<string, unknown>>()
  for (const item of list) {
    if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
      byId.set((item as { id: string }).id, item as Record<string, unknown>)
    }
  }

  let changed = 0
  const merged = products.map((p) => {
    const t = byId.get(p.id)
    if (!t) return p
    const next: TranslatableProduct = { ...p }
    for (const field of FIELDS) {
      const v = t[field]
      if (p[field] && typeof v === 'string' && v.trim()) {
        next[field] = v.trim()
        changed++
      }
    }
    return next
  })
  return { products: merged, translated: changed > 0 }
}
