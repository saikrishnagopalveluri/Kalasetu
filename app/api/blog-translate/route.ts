import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { gemmaText, isGeminiConfigured } from '@/lib/gemini'
import { NextRequest, NextResponse } from 'next/server'
import { readJsonObject } from '@/lib/readJson'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { LANGUAGES } from '@/lib/languages'
import { isRateLimited, clientKey } from '@/lib/rateLimit'
import { applyBrandToText, normalizeBrandToToken } from '@/lib/applyBrand'

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
function stripEmDash(text: string): string {
  return text.replace(/\s*--\s*/g, ', ').replace(/\s*—\s*/g, ', ').replace(/,\s*,/g, ',')
}

async function callAI(system: string, user: string): Promise<string | null> {
  // Bulk translation is the high-volume, low-stakes job Gemma is for; it
  // falls back to Gemini, then Claude, then Groq.
  if (isGeminiConfigured()) {
    try {
      return (await gemmaText({ system, prompt: user, maxTokens: 6144, timeoutMs: 120_000 })).text
    } catch (err) {
      console.error('blog-translate: Gemma and Gemini failed, falling back to Claude:', err)
    }
  }
  // 6144, not the old 3072 — posts now run 1200-1800 words plus an FAQ
  // section, which was getting truncated mid-JSON under the old ceiling.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 6144, system, messages: [{ role: 'user', content: user }],
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
    // 3500, not 6144 — see the identical fix (and its full reasoning) in
    // the daily-blog cron's callAI: Groq's per-minute limit is charged
    // against max_tokens requested, not tokens actually produced, so a
    // ceiling far above what a post really needs guarantees collisions
    // with any other call sharing this account within the same minute.
    const res = await groqClient.chat.completions.create({
      model: 'openai/gpt-oss-120b', max_tokens: 3500,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    })
    return res.choices[0]?.message?.content ?? null
  } catch (groqErr) {
    console.error('blog-translate: Groq fallback also failed:', groqErr)
    return null
  }
}

// Plain-text TITLE:/SUMMARY:/CONTENT: markers, not JSON — a multi-paragraph
// article is exactly the case where asking a model to hand-escape line
// breaks into a valid JSON string goes wrong (see the same fix in the
// daily-blog cron, where this failure mode first showed up for real).
function parseDelimited(raw: string): { title: string; summary?: string; content?: string } | null {
  const cleaned = raw.replace(/^```[a-z]*\s*|```\s*$/gi, '').trim()
  const titleMatch = cleaned.match(/^TITLE:\s*(.+)$/im)
  const summaryMatch = cleaned.match(/^SUMMARY:\s*(.+)$/im)
  const contentIdx = cleaned.search(/^CONTENT:\s*$/im)
  if (!titleMatch) return null
  const content = contentIdx === -1 ? undefined : cleaned.slice(cleaned.indexOf('\n', contentIdx) + 1).trim()
  return { title: titleMatch[1].trim(), summary: summaryMatch?.[1]?.trim(), content }
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

  const { slug, language } = await readJsonObject(request)
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
  if (cached && (cached.content || cached.summary)) {
    return NextResponse.json({
      title: applyBrandToText(cached.title),
      summary: cached.summary ? applyBrandToText(cached.summary) : cached.summary,
      content: cached.content ? applyBrandToText(cached.content) : cached.content,
    })
  }

  const { data: post } = await supabaseAdmin.from('blogs').select('slug, title, summary, content').eq('slug', slug).maybeSingle()
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  // Normalize to the {{BRAND}} token before translating — older posts may
  // still hold a literal brand name baked in from whichever deployment
  // generated them (see the daily-blog cron's own fix for the same root
  // cause). Translating a bad source verbatim was also producing garbled,
  // mixed-script renderings of the brand name in some languages.
  const sourceTitle = normalizeBrandToToken(post.title)
  const sourceSummary = post.summary ? normalizeBrandToToken(post.summary) : ''
  const sourceContent = post.content ? normalizeBrandToToken(post.content) : ''
  const raw = await callAI(
    `Translate the given blog post fields into ${lang.name}. Keep the same meaning, tone, and paragraph structure exactly, including any paragraph that is only "## Section Title" (translate the heading text but keep the "## " prefix so it still renders as a heading), any highlight callout (keep the "> " prefix on each line), and any FAQ pair (keep the "Q: " and "A: " prefixes on their respective lines, translating only the text after each prefix). If the text contains the literal token {{BRAND}} (with double curly braces), copy it through completely unchanged, do not translate, transliterate, or modify it in any way. Do not introduce the em dash character anywhere in the translation, even if it reads naturally in the target language, use a comma or two sentences instead.

Respond in EXACTLY this plain-text format, no markdown fences, no preamble, nothing before "TITLE:" and nothing after the content:
TITLE: the translated title
SUMMARY: the translated summary
CONTENT:
the translated content, with a genuine blank line between paragraphs

Do not use JSON. Do not wrap anything in quotes. Do not escape anything.`,
    `TITLE: ${sourceTitle}\nSUMMARY: ${sourceSummary}\nCONTENT:\n${sourceContent}`
  )
  const translated = raw ? parseDelimited(raw) : null
  if (!translated?.title) {
    return NextResponse.json({ error: 'Translation failed for both providers.' }, { status: 502 })
  }

  // Store as the {{BRAND}} token (normalized again as a safety net in case
  // the model didn't preserve it), resolved to the viewing domain's brand
  // name only when actually returned below — same convention as every
  // other piece of UI copy in this app.
  const stored = {
    title: stripEmDash(normalizeBrandToToken(translated.title)),
    summary: stripEmDash(normalizeBrandToToken(translated.summary ?? post.summary ?? '')),
    content: stripEmDash(normalizeBrandToToken(translated.content ?? post.content ?? '')),
  }
  await supabaseAdmin.from('blog_translations').upsert(
    { blog_slug: slug, language: lang.id, ...stored },
    { onConflict: 'blog_slug,language' }
  )
  return NextResponse.json({
    title: applyBrandToText(stored.title),
    summary: applyBrandToText(stored.summary),
    content: applyBrandToText(stored.content),
  })
}
