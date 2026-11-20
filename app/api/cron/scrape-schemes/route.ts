import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { geminiText, isGeminiConfigured } from '@/lib/gemini'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { BRAND, BRAND_ID } from '@/lib/brand'

// Automated version of app/api/admin/scrape-schemes — same Discover -> Fetch
// -> Extract -> Categorize pipeline, but auto-publishes straight to the
// public `opportunities` table instead of staging in `scheme_candidates`
// for manual approval. That trade was made deliberately: same-day
// visibility for a newly announced scheme matters more here than a human
// review gate, since no admin is reliably online to approve within hours.
// "Discover" is still not automated crawling — sources are still rows in
// scheme_sources an admin added by hand; this only ever fetches URLs a
// human already chose, and still checks robots.txt before every fetch.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null

const EXTRACTION_SYSTEM_PROMPT = `You extract structured information about a government scheme, competition, or trade show from raw webpage text, for a platform helping Indian traditional artisans.

Respond with ONLY a JSON object, no markdown fences, no preamble, using exactly these keys:
{
  "title": "short official name of the scheme/competition/trade show",
  "description": "2-3 plain sentences, written for an artisan with no policy background — what it is, who it's for, what they get. No jargon.",
  "type": "one of: scheme, competition, tradeshow",
  "deadline": "YYYY-MM-DD if a specific deadline is stated in the text, otherwise null",
  "relevant": true or false — is this page actually about a scheme/competition/tradeshow an artisan could apply to or benefit from? false for navigation pages, error pages, or unrelated content
}
If the page text doesn't contain enough to fill this in confidently, set "relevant": false rather than guessing.`

async function extractWithAI(pageText: string): Promise<{
  title: string; description: string; type: string; deadline: string | null; relevant: boolean
} | null> {
  const userMessage = `Webpage text:\n\n${pageText.slice(0, 6000)}`
  if (isGeminiConfigured()) {
    try {
      const { text } = await geminiText({ system: EXTRACTION_SYSTEM_PROMPT, prompt: userMessage, maxTokens: 1024, json: true })
      return JSON.parse(text.replace(/^```json\s*|```\s*$/g, '').trim())
    } catch (geminiError) {
      console.error('[scrape-schemes-cron] Gemini extraction failed, falling back to Claude:', geminiError)
    }
  }
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })
    const block = response.content.find((b) => b.type === 'text')
    if (block && block.type === 'text') return JSON.parse(block.text.replace(/^```json\s*|```\s*$/g, '').trim())
    throw new Error('No text from Claude')
  } catch (claudeError) {
    console.error('[scrape-schemes-cron] Claude extraction failed, falling back to Groq:', claudeError)
    if (!groqClient) return null
    try {
      const groqResponse = await groqClient.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        max_tokens: 1024,
        messages: [{ role: 'system', content: EXTRACTION_SYSTEM_PROMPT }, { role: 'user', content: userMessage }],
      })
      const text = groqResponse.choices[0]?.message?.content
      if (!text) return null
      return JSON.parse(text.replace(/^```json\s*|```\s*$/g, '').trim())
    } catch (groqError) {
      console.error('[scrape-schemes-cron] Groq extraction also failed:', groqError)
      return null
    }
  }
}

async function isAllowedByRobots(pageUrl: string): Promise<boolean> {
  try {
    const origin = new URL(pageUrl).origin
    const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return true
    const body = await res.text()
    const path = new URL(pageUrl).pathname || '/'

    let inWildcardBlock = false
    const disallowed: string[] = []
    for (const rawLine of body.split('\n')) {
      const line = rawLine.split('#')[0].trim()
      if (!line) continue
      const [key, ...rest] = line.split(':')
      const value = rest.join(':').trim()
      if (key.toLowerCase() === 'user-agent') inWildcardBlock = value === '*'
      else if (inWildcardBlock && key.toLowerCase() === 'disallow' && value) disallowed.push(value)
    }
    return !disallowed.some((rule) => path.startsWith(rule))
  } catch (err) {
    console.error(`[scrape-schemes-cron] robots.txt check failed for ${pageUrl}:`, err)
    return true
  }
}

function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type SchemeScrapeResult =
  | { status: 'not-configured' }
  | { status: 'error'; error: string; httpStatus: number }
  | { status: 'done'; checked: number; skippedRobots: number; skippedUnchanged: number; skippedIrrelevant: number; skippedDuplicate: number; published: string[]; errors: string[] }

export async function runSchemeScrape(): Promise<SchemeScrapeResult> {
  if (!supabaseAdmin) {
    return { status: 'not-configured' }
  }

  const { data: sources, error: sourcesError } = await supabaseAdmin
    .from('scheme_sources').select('*').eq('active', true)
  if (sourcesError) {
    return { status: 'error', error: 'Could not load scheme sources.', httpStatus: 500 }
  }

  const summary = { checked: 0, skippedRobots: 0, skippedUnchanged: 0, skippedIrrelevant: 0, skippedDuplicate: 0, published: [] as string[], errors: [] as string[] }

  for (const source of sources ?? []) {
    summary.checked++
    try {
      const allowed = await isAllowedByRobots(source.url)
      if (!allowed) {
        summary.skippedRobots++
        await supabaseAdmin.from('scheme_sources').update({ robots_allowed: false, last_checked_at: new Date().toISOString() }).eq('id', source.id)
        continue
      }

      const pageRes = await fetch(source.url, {
        signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': `${BRAND.name}Bot/1.0 (+${BRAND.fallbackUrl}; artisan scheme directory)` },
      })
      if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`)
      const html = await pageRes.text()
      const text = extractText(html)
      const hash = crypto.createHash('sha256').update(text).digest('hex')

      await supabaseAdmin.from('scheme_sources').update({
        robots_allowed: true, last_checked_at: new Date().toISOString(),
      }).eq('id', source.id)

      if (hash === source.last_content_hash) {
        summary.skippedUnchanged++
        continue
      }

      const extracted = await extractWithAI(text)
      if (!extracted || !extracted.relevant) {
        summary.skippedIrrelevant++
        await supabaseAdmin.from('scheme_sources').update({ last_content_hash: hash }).eq('id', source.id)
        continue
      }

      // A source page changing doesn't always mean a genuinely new scheme —
      // skip if a scheme with this exact title is already published, so a
      // re-crawl of an unchanged-in-substance page doesn't create a
      // duplicate listing every time the source's HTML shifts slightly.
      const { data: existing } = await supabaseAdmin.from('opportunities').select('id').eq('title', extracted.title).maybeSingle()
      if (existing) {
        summary.skippedDuplicate++
        await supabaseAdmin.from('scheme_sources').update({ last_content_hash: hash }).eq('id', source.id)
        continue
      }

      await supabaseAdmin.from('opportunities').insert({
        type: ['scheme', 'competition', 'tradeshow'].includes(extracted.type) ? extracted.type : source.category,
        title: extracted.title,
        description: extracted.description,
        official_url: source.url,
        deadline: extracted.deadline,
      })
      await supabaseAdmin.from('scheme_sources').update({ last_content_hash: hash }).eq('id', source.id)
      summary.published.push(extracted.title)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`[scrape-schemes-cron] Source ${source.url} failed:`, err)
      summary.errors.push(`${source.label}: ${message}`)
    }
  }

  return { status: 'done', ...summary }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Both brand deployments share one database — only the designated
  // deployment actually scrapes, so opportunities never get inserted twice.
  // (This route is no longer itself on the cron schedule — see
  // app/api/cron/daily/route.ts — but stays callable directly for manual
  // admin runs, so the guard stays here too.)
  if (BRAND_ID !== 'hastkatha') {
    return NextResponse.json({ status: 'skipped', reason: `scrape-schemes only runs on the hastkatha deployment (this is ${BRAND_ID})` })
  }

  const result = await runSchemeScrape()
  if (result.status === 'not-configured') {
    return NextResponse.json({ error: 'Scheme ingestion is not set up yet.' }, { status: 503 })
  }
  if (result.status === 'error') {
    return NextResponse.json({ error: result.error }, { status: result.httpStatus })
  }
  return NextResponse.json(result)
}
