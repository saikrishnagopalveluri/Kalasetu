import crypto from 'crypto'
import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { BRAND } from '@/lib/brand'

// Government scheme ingestion pipeline: Discover -> Fetch -> Extract ->
// Categorize -> Verify -> Publish.
//
// "Discover" is deliberately NOT automated crawling — sources are rows in
// scheme_sources that an admin added by hand (see the admin panel). This
// route only ever fetches URLs a human already chose, checks robots.txt
// before every fetch, and never auto-publishes: every result lands in
// scheme_candidates with status='pending' for an admin to approve or reject
// before it can appear in the public opportunities table.

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
    console.error('Claude extraction failed, falling back to Groq:', claudeError)
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
      console.error('Groq extraction also failed:', groqError)
      return null
    }
  }
}

async function isAllowedByRobots(pageUrl: string): Promise<boolean> {
  try {
    const origin = new URL(pageUrl).origin
    const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return true // no robots.txt / can't reach it -> nothing explicitly disallowed
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
    console.error(`robots.txt check failed for ${pageUrl}:`, err)
    return true // fetch failure on robots.txt itself — don't block on an inconclusive check
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

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Scheme ingestion is not set up yet.' }, { status: 503 })
  }

  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!accessToken) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
  if (userError || !userData.user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: profile } = await supabaseAdmin.from('artisan_profiles').select('is_admin').eq('id', userData.user.id).maybeSingle()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })

  const { data: sources, error: sourcesError } = await supabaseAdmin
    .from('scheme_sources').select('*').eq('active', true)
  if (sourcesError) {
    return NextResponse.json({ error: 'Could not load scheme sources.' }, { status: 500 })
  }

  const summary = { checked: 0, skippedRobots: 0, skippedUnchanged: 0, skippedIrrelevant: 0, newCandidates: 0, errors: [] as string[] }

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

      await supabaseAdmin.from('scheme_candidates').insert({
        source_id: source.id,
        content_hash: hash,
        type: ['scheme', 'competition', 'tradeshow'].includes(extracted.type) ? extracted.type : source.category,
        title: extracted.title,
        description: extracted.description,
        official_url: source.url,
        deadline: extracted.deadline,
        status: 'pending',
      })
      await supabaseAdmin.from('scheme_sources').update({ last_content_hash: hash }).eq('id', source.id)
      summary.newCandidates++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error(`Scheme source ${source.url} failed:`, err)
      summary.errors.push(`${source.label}: ${message}`)
    }
  }

  return NextResponse.json(summary)
}
