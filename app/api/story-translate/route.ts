import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { readJsonObject } from '@/lib/readJson'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { LANGUAGES } from '@/lib/languages'
import { isRateLimited, clientKey } from '@/lib/rateLimit'

// Deliberately unauthenticated, same reasoning as app/api/blog-translate —
// /community is public, so a reader shouldn't need to log in just to read a
// story in their own language. Kept safe the same way: the client can only
// supply a story id + language, never arbitrary text; only PUBLISHED
// stories are ever fetched; every result is cached forever in
// story_translations, so spend is bounded by (published stories) x
// (languages), not by traffic.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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
      console.error(`story-translate: Claude attempt ${attempt} failed (${looksRateLimited ? 'rate-limited' : 'error'}):`, message)
      if (looksRateLimited && attempt === 1) { await sleep(2000); continue }
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
    console.error('story-translate: Groq fallback also failed:', groqErr)
    return null
  }
}

function parseJson(raw: string): { title: string; content?: string } | null {
  try {
    return JSON.parse(raw.replace(/^```json\s*|```\s*$/g, '').trim())
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

  if (isRateLimited(`story-translate:${clientKey(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: 'Too many requests. Please try again in a minute.' }, { status: 429 })
  }

  const { storyId, language } = await readJsonObject(request)
  if (typeof storyId !== 'string' || typeof language !== 'string') {
    return NextResponse.json({ error: 'storyId and language are required' }, { status: 400 })
  }
  const lang = LANGUAGES.find((l) => l.id === language)
  if (!lang) return NextResponse.json({ error: 'Invalid language' }, { status: 400 })

  const { data: story } = await supabaseAdmin.from('stories').select('id, title, content, language')
    .eq('id', storyId).eq('status', 'PUBLISHED').maybeSingle()
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

  // Already in the requested language — nothing to translate.
  if (story.language === lang.id) return NextResponse.json({ title: story.title, content: story.content })

  const { data: cached } = await supabaseAdmin
    .from('story_translations').select('title, content')
    .eq('story_id', storyId).eq('language', lang.id).maybeSingle()
  if (cached) return NextResponse.json(cached)

  const raw = await callAI(
    `Translate the given JSON story fields fully into ${lang.name} — every word of ordinary prose (nouns, verbs, adjectives, common craft vocabulary like "loom", "thread", "weaving", "skill", "dye") must be translated into ${lang.name}, written in ${lang.name}'s own script. The ONLY exceptions, left exactly as in the original: (1) a person's proper name, (2) a place name, (3) the specific, one-word or short name of a named traditional weave, dye, or motif technique (e.g. "Ikat", "Bandhani", "Ajrakh") that has no natural ${lang.name} equivalent. Do not leave any other word in the source language or script — a translation with stray untranslated common words is a failed translation. Respond with ONLY a JSON object with the same keys (title, content), no markdown fences, no preamble.`,
    JSON.stringify({ title: story.title, content: story.content })
  )
  const translated = raw ? parseJson(raw) : null
  if (!translated?.title || !translated?.content) {
    return NextResponse.json({ error: 'Translation failed for both providers.' }, { status: 502 })
  }

  const result = { title: translated.title, content: translated.content }
  await supabaseAdmin.from('story_translations').upsert(
    { story_id: storyId, language: lang.id, ...result },
    { onConflict: 'story_id,language' }
  )
  return NextResponse.json(result)
}
