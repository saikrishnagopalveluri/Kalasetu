import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { LANGUAGES } from '@/lib/languages'
import { isRateLimited, clientKey } from '@/lib/rateLimit'

// Deliberately unauthenticated — /blog itself is public now, so a reader
// browsing in Hindi shouldn't need to log in just to get a translated post.
// The old path went through /api/ai, which requires a signed-in session;
// that silently failed for every logged-out visitor once /blog was
// un-gated, so every post fell back to English except the one post a
// separate pipeline (the daily-blog cron) had already pre-translated.
//
// Kept safe by construction rather than by an auth check: the client can
// only supply a slug + language code, never arbitrary text — the server
// fetches the real post itself — and every result is cached permanently in
// blog_translations, so total AI spend is bounded by
// (number of real posts) x (number of languages), not by traffic.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Multiple readers landing on /blog at once in a new language can trigger
// several of these concurrently (see BlogListView, which also batches its
// own requests) — retry once on anything that looks like a rate limit
// before falling back to Groq, same fix applied to the daily-blog cron.
async function callAI(system: string, user: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 3072, system, messages: [{ role: 'user', content: user }],
      })
      const block = res.content.find((b) => b.type === 'text')
      return block && block.type === 'text' ? block.text : null
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const looksRateLimited = /rate.?limit|429|overloaded|529/i.test(message)
      console.error(`blog-translate: Claude attempt ${attempt} failed (${looksRateLimited ? 'rate-limited' : 'error'}):`, message)
      if (looksRateLimited && attempt === 1) {
        await sleep(2000)
        continue
      }
      break
    }
  }
  if (!groqClient) return null
  try {
    const res = await groqClient.chat.completions.create({
      model: 'openai/gpt-oss-120b', max_tokens: 3072,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    })
    return res.choices[0]?.message?.content ?? null
  } catch (groqErr) {
    console.error('blog-translate: Groq fallback also failed:', groqErr)
    return null
  }
}

function parseJson(raw: string): { title: string; summary?: string; content?: string } | null {
  try {
    return JSON.parse(raw.replace(/^```json\s*|```\s*$/g, '').trim())
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  // Every real translation is cached forever, so a legitimate reader never
  // needs more than a handful of these — 20/minute is generous for a real
  // visitor switching languages a few times, but stops a single client from
  // hammering this with made-up slugs to burn AI calls (those still 404
  // before touching AI, but the DB lookup itself isn't free either).
  if (isRateLimited(`blog-translate:${clientKey(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a minute.' }, { status: 429 })
  }

  const { slug, language } = await request.json()
  if (typeof slug !== 'string' || typeof language !== 'string') {
    return NextResponse.json({ error: 'slug and language are required' }, { status: 400 })
  }
  const lang = LANGUAGES.find((l) => l.id === language)
  if (!lang || lang.id === 'en') {
    return NextResponse.json({ error: 'Invalid language' }, { status: 400 })
  }

  const { data: cached } = await supabaseAdmin
    .from('blog_translations').select('title, summary, content')
    .eq('blog_slug', slug).eq('language', lang.id).maybeSingle()
  if (cached && (cached.content || cached.summary)) return NextResponse.json(cached)

  const { data: post } = await supabaseAdmin.from('blogs').select('slug, title, summary, content').eq('slug', slug).maybeSingle()
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const raw = await callAI(
    `Translate the given JSON blog post fields into ${lang.name}. Keep the same meaning, tone, and paragraph structure exactly, including any paragraph that is only "## Section Title" — translate the heading text but keep the "## " prefix so it still renders as a heading. Respond with ONLY a JSON object with the same keys (title, summary, content), no markdown fences, no preamble.`,
    JSON.stringify({ title: post.title, summary: post.summary, content: post.content })
  )
  const translated = raw ? parseJson(raw) : null
  if (!translated?.title) {
    return NextResponse.json({ error: 'Translation failed for both providers.' }, { status: 502 })
  }

  const result = { title: translated.title, summary: translated.summary ?? post.summary, content: translated.content ?? post.content }
  await supabaseAdmin.from('blog_translations').upsert(
    { blog_slug: slug, language: lang.id, ...result },
    { onConflict: 'blog_slug,language' }
  )
  return NextResponse.json(result)
}
