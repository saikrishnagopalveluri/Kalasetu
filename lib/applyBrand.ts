import { BRAND } from './brand'

// Blog posts are AI-generated and stored as plain text (unlike UI strings,
// which all route through the {{BRAND}} placeholder + lib/translations.ts's
// own substitution). A post generated while one brand's env was active
// permanently contains that brand's literal name, and since both brands
// share one Supabase database, the wrong brand name — and, if the post was
// ever machine-translated, a garbled rendering of it — could show up
// verbatim on the other domain. Applied at render time so it's correct
// regardless of which brand's cron job originally wrote the post, with no
// data migration required.
const ALL_BRAND_NAMES = ['KalaSetu', 'Hastkatha']
const OTHER_BRAND_NAMES = ALL_BRAND_NAMES.filter((name) => name !== BRAND.name)

export function applyBrandToText(text: string): string {
  let out = text.includes('{{BRAND}}') ? text.split('{{BRAND}}').join(BRAND.name) : text
  for (const other of OTHER_BRAND_NAMES) {
    out = out.split(other).join(BRAND.name)
  }
  return out
}

// Opposite direction — used right before AI generation/translation stores
// text, as a safety net in case the model wrote a real brand name instead
// of following the {{BRAND}}-token instruction in its prompt.
export function normalizeBrandToToken(text: string): string {
  let out = text
  for (const name of ALL_BRAND_NAMES) {
    out = out.split(name).join('{{BRAND}}')
  }
  return out
}
