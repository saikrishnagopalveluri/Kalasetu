import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { LANGUAGES } from '@/lib/languages'
import { BRAND_ID } from '@/lib/brand'
import { normalizeBrandToToken } from '@/lib/applyBrand'
import { findRealPhoto } from '@/lib/stockImage'

// Vercel Cron hits this on alternating days (see app/api/cron/daily/route.ts
// — this file is also still directly callable for manual/admin runs). It
// picks the day's topic from a fixed rotation, writes one English post with
// a header image, then translates it into every other supported language up
// front — so an artisan never has to wait for a live AI translation the way
// blog/[slug] does for older posts, and every reader sees a fresh post in
// their own language on day one.
export const maxDuration = 300

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null

// A fixed rotation rather than "let the AI pick a fresh topic" — keeps
// coverage predictable (pricing comes up as often as marketing) and avoids
// the AI drifting toward the same few obvious topics every day.
const TOPICS: { slugBase: string; category: string; brief: string }[] = [
  { slugBase: 'pricing-tip', category: 'business', brief: 'a practical tip for pricing handmade craft products fairly, covering both material and labour cost' },
  { slugBase: 'craft-spotlight', category: 'craft-spotlight', brief: 'a spotlight on one traditional Indian craft technique (pick a different one than obvious choices like Madhubani or Kalamkari each time), its history and what makes it distinctive' },
  { slugBase: 'marketing-idea', category: 'marketing', brief: 'one specific, actionable idea for marketing handmade products on WhatsApp or Instagram' },
  { slugBase: 'scheme-explainer', category: 'schemes', brief: 'a plain-language explainer of a real Indian government scheme or program that helps artisans (e.g. PM Vishwakarma, MSME registration, GI tagging) — pick a different one each time' },
  { slugBase: 'photo-tip', category: 'ai-tools', brief: `a practical tip for taking or presenting better product photos, including how {{BRAND}}'s Studio tool (turns a plain product photo into a styled photoshoot-style image) can help` },
  { slugBase: 'business-basics', category: 'business', brief: 'a foundational small-business skill for artisans, like managing orders, tracking expenses, or handling a first wholesale inquiry' },
  { slugBase: 'customer-story-angle', category: 'marketing', brief: 'how to tell the story behind a handmade product in a way that helps it sell, without sounding exaggerated or fake' },
  { slugBase: 'seasonal-planning', category: 'business', brief: 'planning craft production and stock around Indian festival seasons and demand spikes' },
  {
    slugBase: 'ai-tools-explainer',
    category: 'ai-tools',
    brief: `a plain explanation of one of {{BRAND}}'s real AI features and how to get better results from it. Pick exactly one of these real, currently-live features — do not invent a feature name or describe any capability not in this list: `
      + `Studio (turns a plain product photo, plus a name and material, into a styled photoshoot-style image — the AI reinterprets the product, it does not edit the exact uploaded photo); `
      + `Content (writes a product description or a craft-story paragraph from the product's name, material, and craft type); `
      + `Design Studio (generates a new design-inspiration image blending the artisan's craft with a chosen theme, like nature or temple architecture motifs); `
      + `Ask AI / the business coach (answers pricing, marketing, and scheme questions in the artisan's own language); `
      + `the pricing calculator (turns labour hours, materials cost, and a margin or markup percentage into a recommended selling price — plain arithmetic, not AI); `
      + `Promote (turns a saved product into an Instagram caption, WhatsApp message, or Facebook post).`,
  },
  { slugBase: 'export-and-scale', category: 'business', brief: 'what it actually takes for a small artisan business to start selling beyond their local market, including realistic first steps' },
]

function todaysTopic(date: Date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0)
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000)
  return TOPICS[dayOfYear % TOPICS.length]
}

// Structure, headline, and E-E-A-T guidance below is synthesized from
// standard blog-writing references (hook openings, short scannable
// paragraphs, benefit-led headlines, concrete evidence over vague
// authority) and adapted to this audience: artisans with variable digital
// literacy reading mostly on a phone, not general blog readers. Table of
// contents and share buttons from those references are deliberately
// skipped — the site's own design already handles that. The humanizer
// pass (removing AI writing tells, adding real voice) is folded directly
// into this prompt rather than run as a second pass, since this content
// is generated unattended with no human editor in the loop afterward.
const CONTENT_SYSTEM_PROMPT = `You write blog posts for {{BRAND}}, a platform for traditional Indian artisans. Audience: artisans with variable digital literacy, reading mostly on a phone, no business-jargon background. Also written so it holds up to Google's E-E-A-T standard (experience, expertise, authoritativeness, trustworthiness) and reads like a genuine expert on this topic wrote it, not a summary of what one might say.

Length and structure — 1200 to 1800 words total, no shorter:
- Opening paragraph (100-150 words), no heading: hook the reader in the first sentence with a real scenario, a direct question, or a concrete situation the reader recognizes — never "In today's world..." or any throat-clearing opener
- 4 to 6 body sections, each starting with a paragraph that is ONLY "## Section Title" (sentence case, no markdown bold, no colon-explainer) followed by 150-300 words for that section
- Inside the body sections, add 1-2 short highlight or insight callouts — a single punchy sentence of real, specific value (a concrete tip, a number, a named technique) as its own paragraph starting with "> " — placed where it naturally lands, not tacked on
- Use a bulleted list (lines starting with "- ") inside a section only where the content is genuinely a list (steps, options, examples) — don't force one into prose
- End with a "## Frequently Asked Questions" section containing 4 to 5 real questions a person searching this topic would actually type into Google. Format each pair as its own paragraph, question and answer on two separate lines within it: the first line "Q: the question", the second line "A: a direct, specific 1-3 sentence answer" — no heading per question, no numbering
- After the FAQ, one final short paragraph (no heading) with one specific, concrete next step the reader can take today — not a vague "start today!" line

Search and keywords:
- Write toward the real primary keyword phrase a person would type to find this exact post (e.g. for a pricing post: "how to price handmade products"), and work it in naturally within the first 100 words and once more in a heading, exactly as a person would say it, never repeated mechanically
- Use a handful of closely related terms and phrasings (LSI terms) the way a knowledgeable person actually talks about the topic — for a pricing post that's naturally also "cost," "margin," "selling price"; for a craft post that's naturally also the material, the region, or the tool names — never as a stuffed keyword list

Voice — this is read by a real person, not scanned by a bot, so it has to sound like one wrote it:
- Warm, plain, practical, like a knowledgeable friend, not a consultant or a press release
- Vary sentence length and rhythm on purpose: some short, some longer, never a run of identical-length sentences
- Paragraphs short: 2-4 sentences each inside a section, never a wall of text
- It is fine and encouraged to write in a grounded, first-person-plural voice where it fits ("we've found," "artisans on {{BRAND}} tell us") for a general pattern you have real basis for, but never invent a specific named individual, a specific quote, or a specific fabricated anecdote presented as a real event
- No em dash character anywhere in the output, in any language, under any circumstance — not for asides, not for a pause, not for a range. Use a comma, a period, "and," "but," or two sentences instead. This applies to the title, the summary, and the content
- No AI-vocabulary filler: "delve," "boasts," "testament to," "crucial," "vibrant," "underscore," "elevate," "tapestry," "rich cultural heritage," "in today's fast-paced world," "it's not just X, it's Y"
- No vague attribution ("experts say," "studies show") — if you reference something specific and real (a named scheme, a named technique, a named place), name it plainly; if you're not certain of a specific number or statistic, don't state one as fact
- Never fabricate statistics, dates, or figures. Concrete, specific, and true beats vague-but-impressive — this is what actually earns a reader's trust
- If a topic asks you to reference a specific {{BRAND}} feature, only describe capabilities that topic actually names — never invent a button, setting, resolution requirement, or sub-feature that wasn't given to you
- Ground claims in specific, checkable detail (a named technique, a real place, a concrete number when you're sure of it) rather than generic claims — specificity is itself the evidence of real expertise
- Wherever you would name the platform, write the exact literal text {{BRAND}} (including the double curly braces) instead of an actual name — never write out a real brand name, and never translate, transliterate, or otherwise alter {{BRAND}}. It gets substituted with the correct name automatically after you write it.

Respond in EXACTLY this plain-text format, no markdown fences, no preamble, nothing before "TITLE:" and nothing after the content:
TITLE: the headline, specific and benefit-led, 6-13 words, no clickbait, no em dash
SUMMARY: one sentence, under 20 words, for a list preview, no em dash
IMAGE_QUERY: a short, plain 2-5 word search phrase for a real stock photo that matches this post, e.g. handloom weaving India or block printing fabric, describe the real physical thing to search for, not an abstract concept
CONTENT:
the full 1200-1800 word article per the structure above, with a genuine blank line between paragraphs

Do not use JSON. Do not wrap the content in quotes. Do not escape anything. Write it exactly as it should be read, with real line breaks.`

const TRANSLATION_SYSTEM_PROMPT = `Translate the given blog post fields into the requested language. Keep the same meaning, tone, and paragraph structure exactly, including any paragraph that is only "## Section Title" (translate the heading text but keep the "## " prefix), any bulleted list (keep the "- " prefix on each line), any highlight callout (keep the "> " prefix on each line), and any FAQ pair (keep the "Q: " and "A: " prefixes on their respective lines, each translated after the prefix). If the text contains the literal token {{BRAND}} (with double curly braces), copy it through completely unchanged, never translate, transliterate, or modify it. Do not introduce the em dash character anywhere in the translation, even if the target language commonly uses one for this construction, use a comma or two sentences instead.

Respond in EXACTLY this plain-text format, no markdown fences, no preamble, nothing before "TITLE:" and nothing after the content:
TITLE: the translated title
SUMMARY: the translated summary
CONTENT:
the translated content, with a genuine blank line between paragraphs

Do not use JSON. Do not wrap anything in quotes. Do not escape anything. Write it exactly as it should be read, with real line breaks.`

// A hard safety net behind the "no em dash" instruction above — the model
// follows it well but not perfectly, and this is unattended content with
// no human editor to catch a stray one before it publishes. Covers both
// the plain em dash and the common double-hyphen stand-in some models use.
function stripEmDash(text: string): string {
  return text.replace(/\s*--\s*/g, ', ').replace(/\s*—\s*/g, ', ').replace(/,\s*,/g, ',')
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// A first real run (firing all 22 translation calls at once via
// Promise.allSettled) hit provider rate limits hard: 21 of 22 failed, only
// 1 succeeded. callAI now retries once on anything that looks like a rate
// limit, and the caller below runs translations in small batches instead
// of all at once — see the batched loop further down.
async function callAI(system: string, user: string, label: string): Promise<string | null> {
  // 6144 tokens rather than the old 3072 — a 1200-1800 word article plus its
  // FAQ section runs well past the old ceiling and was getting silently
  // truncated mid-JSON.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 6144,
        system,
        messages: [{ role: 'user', content: user }],
      })
      const block = response.content.find((b) => b.type === 'text')
      if (block && block.type === 'text') return block.text
      console.error(`[daily-blog] ${label}: Claude returned no text block`)
      return null
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const looksRateLimited = /rate.?limit|429|overloaded|529/i.test(message)
      console.error(`[daily-blog] ${label}: Claude attempt ${attempt} failed (${looksRateLimited ? 'rate-limited' : 'error'}):`, message)
      if (looksRateLimited && attempt === 1) {
        await sleep(2000 * attempt)
        continue
      }
      break
    }
  }
  if (!groqClient) return null
  try {
    // 3500, not 6144 — Groq's per-minute token limit is charged against the
    // max_tokens a request asks for, not what it actually generates. At
    // 6144 (comfortably enough for a 1200-1800 word article, but far more
    // headroom than it needs) a single request could reserve almost the
    // entire 8000 TPM budget by itself, so any two calls within the same
    // rolling minute collided on that account's shared organization-wide
    // limit — which explains why nearly every backfill call was failing
    // even with generous pauses between them. 3500 covers the real output
    // (~2500 tokens) with margin, while leaving room for a second request
    // to land in the same window instead of guaranteeing a collision.
    const res = await groqClient.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      max_tokens: 3500,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    })
    return res.choices[0]?.message?.content ?? null
  } catch (groqErr) {
    const message = groqErr instanceof Error ? groqErr.message : String(groqErr)
    console.error(`[daily-blog] ${label}: Groq fallback also failed:`, message)
    return null
  }
}

// Plain-text TITLE:/SUMMARY:/[IMAGE_QUERY:]/CONTENT: delimiters instead of
// JSON. A 1200-1800 word article with real paragraph breaks is exactly the
// case where asking a model to hand-escape a multi-paragraph string into
// valid JSON goes wrong in practice — the first real run of the longer
// format produced several "response was not valid JSON" failures from
// literal, unescaped newlines inside a JSON string value. Splitting on
// plain-text markers never has that failure mode, since the content is
// never asked to survive round-tripping through string escaping.
function parseDelimitedResponse(raw: string, label: string): { title: string; summary: string; content: string; imageSearchQuery?: string } | null {
  const cleaned = raw.replace(/^```[a-z]*\s*|```\s*$/gi, '').trim()
  const titleMatch = cleaned.match(/^TITLE:\s*(.+)$/im)
  const summaryMatch = cleaned.match(/^SUMMARY:\s*(.+)$/im)
  const imageMatch = cleaned.match(/^IMAGE_QUERY:\s*(.+)$/im)
  const contentIdx = cleaned.search(/^CONTENT:\s*$/im)

  if (!titleMatch || !summaryMatch || contentIdx === -1) {
    console.error(`[daily-blog] ${label}: response missing required TITLE/SUMMARY/CONTENT markers:`, cleaned.slice(0, 200))
    return null
  }

  const contentStart = cleaned.indexOf('\n', contentIdx) + 1
  const content = cleaned.slice(contentStart).trim()
  if (!content) {
    console.error(`[daily-blog] ${label}: CONTENT section was empty`)
    return null
  }

  return {
    title: titleMatch[1].trim(),
    summary: summaryMatch[1].trim(),
    content,
    imageSearchQuery: imageMatch?.[1]?.trim(),
  }
}

// Best-effort — a post with no image is far better than a post that never
// publishes because the photo search had a bad day. A real photo from
// Wikimedia Commons is used instead of an AI-generated one, per the user's
// request for a relatable real picture rather than a generated one; linked
// directly from Commons' own CDN rather than re-hosted, with the required
// attribution stored alongside it.
async function findHeaderImage(query: string): Promise<{ url: string; credit: string } | null> {
  const photo = await findRealPhoto(query)
  if (!photo) {
    console.error('[daily-blog] no real photo found for query:', query)
    return null
  }
  return { url: photo.url, credit: photo.credit }
}

export type DailyBlogResult =
  | { status: 'skipped' | 'already-published' | 'not-configured'; reason?: string; slug?: string }
  | { status: 'error'; error: string; httpStatus: number }
  | { status: 'published'; slug: string; title: string; hasImage: boolean; translated: number; failed: string[] }

// topicOverride/slugOverride let an admin force a specific topic and reuse
// an existing slug (in-place regeneration) instead of the day-rotation pick
// — used to backfill new posts on demand and to bring old posts up to a
// revised format without changing their published URL. The normal daily
// cron path calls this with neither, which is the original behavior.
export async function runDailyBlog(
  topicOverride?: { slugBase: string; category: string; brief: string },
  slugOverride?: string,
  skipTranslation?: boolean
): Promise<DailyBlogResult> {
  if (!supabaseAdmin) {
    return { status: 'not-configured', reason: 'missing service role key' }
  }

  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10)
  const topic = topicOverride ?? todaysTopic(today)
  const slug = slugOverride ?? `${topic.slugBase}-${dateStr}`
  const isRegeneration = !!slugOverride

  if (!isRegeneration) {
    const { data: existing } = await supabaseAdmin.from('blogs').select('slug').eq('slug', slug).maybeSingle()
    if (existing) {
      return { status: 'already-published', slug }
    }
  }

  const raw = await callAI(CONTENT_SYSTEM_PROMPT, `Write today's post about: ${topic.brief}`, 'en-content')
  const post = raw ? parseDelimitedResponse(raw, 'en-content') : null
  if (!post) {
    return { status: 'error', error: 'AI content generation failed for both providers.', httpStatus: 502 }
  }

  const image = post.imageSearchQuery ? await findHeaderImage(post.imageSearchQuery) : null

  // Safety net behind the "no em dash" instruction in the prompt, and in
  // case the model named the platform directly instead of following the
  // {{BRAND}}-token instruction above — normalize both before this becomes
  // permanently stored content shared by both brands.
  const row = {
    slug,
    title: stripEmDash(normalizeBrandToToken(post.title)),
    summary: stripEmDash(normalizeBrandToToken(post.summary)),
    content: stripEmDash(normalizeBrandToToken(post.content)),
    category: topic.category, image_url: image?.url ?? null, image_credit: image?.credit ?? null,
  }
  let { error: writeError } = isRegeneration
    ? await supabaseAdmin.from('blogs').update(row).eq('slug', slug)
    : await supabaseAdmin.from('blogs').insert(row)
  // supabase/040_blog_image_credit.sql may not be applied yet on whichever
  // database this runs against — retry without the new column rather than
  // fail the whole post over one missing field once it lands, this branch
  // is dead code and harmless to leave in place.
  if (writeError && /image_credit/i.test(writeError.message)) {
    const { image_credit: _imageCredit, ...rowWithoutCredit } = row
    const retry = isRegeneration
      ? await supabaseAdmin.from('blogs').update(rowWithoutCredit).eq('slug', slug)
      : await supabaseAdmin.from('blogs').insert(rowWithoutCredit)
    writeError = retry.error
  }
  if (writeError) {
    return { status: 'error', error: `Failed to save post: ${writeError.message}`, httpStatus: 500 }
  }

  // Regenerating an existing post invalidates any translation cached
  // against its old content — deleting them lets the existing on-demand
  // translation path (blog-translate) regenerate correctly against the new
  // English text the next time each is actually read, rather than serving
  // a stale mismatched translation indefinitely.
  if (isRegeneration) {
    await supabaseAdmin.from('blog_translations').delete().eq('blog_slug', slug)
  }

  // skipTranslation publishes the English post immediately and leaves every
  // language untranslated for now — added after Anthropic's own account ran
  // out of credit mid-session, which combined with Groq's per-minute cap
  // made the full 22-language batch take minutes per post and fail on most
  // languages anyway. A reader who picks an untranslated language still
  // gets it via the existing on-demand blog-translate path the first time
  // they read it; translateAllLanguages (below) is the other way to fill
  // these in, without paying for content generation again.
  const { translated: translatedCount, failed } = skipTranslation
    ? { translated: 0, failed: [] as string[] }
    : await translateAllLanguages(slug, post.title, post.summary, post.content)

  return { status: 'published', slug, title: post.title, hasImage: !!image, translated: translatedCount, failed }
}

// Translates one existing post into every language that isn't 'en', skipping
// content generation entirely — used both by runDailyBlog right after it
// writes a new post, and standalone (?translateSlug=<slug>) to backfill
// coverage for a post whose English content is already right and doesn't
// need to change. Batches of 4 with a pause between them, rather than all
// 22 at once: firing every request simultaneously hit provider rate limits
// hard on the first real run (21 of 22 failed).
async function translateAllLanguages(
  slug: string, title: string, summary: string, content: string, pauseMs = 1500, onlyLanguageIds?: string[]
): Promise<{ translated: number; failed: string[] }> {
  const otherLanguages = LANGUAGES.filter((l) => l.id !== 'en' && (!onlyLanguageIds || onlyLanguageIds.includes(l.id)))
  const BATCH_SIZE = 4
  const translatedOk: string[] = []
  const failed: string[] = []

  for (let i = 0; i < otherLanguages.length; i += BATCH_SIZE) {
    const batch = otherLanguages.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (lang) => {
        const raw = await callAI(
          TRANSLATION_SYSTEM_PROMPT,
          `Translate into ${lang.name}:\n\nTITLE: ${title}\nSUMMARY: ${summary}\nCONTENT:\n${content}`,
          `translate-${lang.id}`
        )
        const translated = raw ? parseDelimitedResponse(raw, `translate-${lang.id}`) : null
        if (!translated) throw new Error(`no usable translation`)
        const { error } = await supabaseAdmin!.from('blog_translations').upsert(
          {
            blog_slug: slug, language: lang.id,
            title: stripEmDash(normalizeBrandToToken(translated.title)),
            summary: stripEmDash(normalizeBrandToToken(translated.summary)),
            content: stripEmDash(normalizeBrandToToken(translated.content)),
          },
          { onConflict: 'blog_slug,language' }
        )
        if (error) throw new Error(error.message)
        return lang.id
      })
    )
    results.forEach((r, j) => {
      if (r.status === 'fulfilled') translatedOk.push(r.value)
      else failed.push(`${batch[j].id}: ${r.reason}`)
    })
    if (i + BATCH_SIZE < otherLanguages.length) await sleep(pauseMs)
  }

  return { translated: translatedOk.length, failed }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Both brand deployments build from this same repo, so both would
  // register this in Vercel if it were on a schedule — but they share one
  // database, and running the job twice would insert (and pay AI-generation
  // cost for) the same post twice. Only the designated deployment runs it.
  // (This route is no longer itself on the cron schedule — see
  // app/api/cron/daily/route.ts — but stays callable directly for manual
  // admin runs, so the guard stays here too.)
  if (BRAND_ID !== 'hastkatha') {
    return NextResponse.json({ status: 'skipped', reason: `daily-blog only runs on the hastkatha deployment (this is ${BRAND_ID})` })
  }

  // Two admin-only query params, same Bearer auth as the plain cron call,
  // used for one-off backfilling rather than waiting on the day rotation:
  // ?topicIndex=N forces today's post to use TOPICS[N] regardless of what
  // day it is; ?regenerateSlug=<slug> rewrites an existing post's content
  // and image in place (same URL, new format) using its own current title
  // as the brief, for bringing older posts up to a revised format.
  const topicIndexParam = request.nextUrl.searchParams.get('topicIndex')
  const regenerateSlug = request.nextUrl.searchParams.get('regenerateSlug')
  const translateSlug = request.nextUrl.searchParams.get('translateSlug')
  const skipTranslation = request.nextUrl.searchParams.get('skipTranslation') === 'true'

  // Backfills every missing language for a post whose English content is
  // already right, without paying for content generation again. Skips any
  // language that already has a cached row, so re-running this after a
  // partial failure only retries what's actually missing.
  if (translateSlug) {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
    const { data: post } = await supabaseAdmin.from('blogs').select('slug, title, summary, content').eq('slug', translateSlug).maybeSingle()
    if (!post) return NextResponse.json({ error: `No post found with slug ${translateSlug}` }, { status: 404 })
    const { data: existingTranslations } = await supabaseAdmin.from('blog_translations').select('language').eq('blog_slug', translateSlug)
    const already = new Set((existingTranslations ?? []).map((t) => t.language))
    const missing = LANGUAGES.filter((l) => l.id !== 'en' && !already.has(l.id)).map((l) => l.id)
    if (missing.length === 0) return NextResponse.json({ status: 'already-published', slug: translateSlug, translated: 0, failed: [] })
    const { translated, failed } = await translateAllLanguages(post.slug, post.title, post.summary ?? '', post.content ?? '', 1500, missing)
    return NextResponse.json({ status: 'translated', slug: post.slug, title: post.title, translated, failed })
  }

  let result: DailyBlogResult
  if (regenerateSlug) {
    if (!supabaseAdmin) return NextResponse.json({ error: 'Not configured' }, { status: 503 })
    const { data: existingPost } = await supabaseAdmin.from('blogs').select('slug, title, category').eq('slug', regenerateSlug).maybeSingle()
    if (!existingPost) return NextResponse.json({ error: `No post found with slug ${regenerateSlug}` }, { status: 404 })
    const brief = `a full rewrite of an existing post whose current title and subject is "${existingPost.title}" (category: ${existingPost.category}) — cover the same real subject in the new, longer format, don't just pad the old version`
    result = await runDailyBlog({ slugBase: existingPost.slug, category: existingPost.category, brief }, existingPost.slug, skipTranslation)
  } else if (topicIndexParam) {
    const idx = Number(topicIndexParam)
    if (!Number.isInteger(idx) || idx < 0 || idx >= TOPICS.length) {
      return NextResponse.json({ error: `topicIndex must be 0-${TOPICS.length - 1}` }, { status: 400 })
    }
    result = await runDailyBlog(TOPICS[idx], undefined, skipTranslation)
  } else {
    result = await runDailyBlog(undefined, undefined, skipTranslation)
  }

  if (result.status === 'error') {
    return NextResponse.json({ error: result.error }, { status: result.httpStatus })
  }
  if (result.status === 'not-configured') {
    return NextResponse.json({ error: 'Daily blog cron is not set up yet (missing service role key).' }, { status: 503 })
  }
  return NextResponse.json(result)
}
