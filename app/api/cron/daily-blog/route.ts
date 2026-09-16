import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { LANGUAGES } from '@/lib/languages'
import { BRAND, BRAND_ID } from '@/lib/brand'
import { generateImage, AllProvidersFailedError } from '@/lib/imageProviders'

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
  { slugBase: 'photo-tip', category: 'ai-tools', brief: `a practical tip for taking or presenting better product photos, including how ${BRAND.name}'s Studio tool (turns a plain product photo into a styled photoshoot-style image) can help` },
  { slugBase: 'business-basics', category: 'business', brief: 'a foundational small-business skill for artisans, like managing orders, tracking expenses, or handling a first wholesale inquiry' },
  { slugBase: 'customer-story-angle', category: 'marketing', brief: 'how to tell the story behind a handmade product in a way that helps it sell, without sounding exaggerated or fake' },
  { slugBase: 'seasonal-planning', category: 'business', brief: 'planning craft production and stock around Indian festival seasons and demand spikes' },
  {
    slugBase: 'ai-tools-explainer',
    category: 'ai-tools',
    brief: `a plain explanation of one of ${BRAND.name}'s real AI features and how to get better results from it. Pick exactly one of these real, currently-live features — do not invent a feature name or describe any capability not in this list: `
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
// contents, share buttons, and author-photo bylines from those references
// are deliberately skipped — they add complexity this audience doesn't
// need and the site's own design already handles attribution.
const CONTENT_SYSTEM_PROMPT = `You write blog posts for ${BRAND.name}, a platform for traditional Indian artisans. Audience: artisans with variable digital literacy, reading mostly on a phone, no business-jargon background.

Writing standard (matches how a careful editor at ${BRAND.name} would review this before publishing):
- Headline: specific and benefit-led (what the reader gets), 6-13 words, no clickbait — it must be something the piece actually delivers
- Opening paragraph: hook the reader in the first sentence — a real scenario, a direct question, or a concrete situation the reader recognizes, never a throat-clearing "In today's world..." style opener
- Tone: warm, plain, practical — like a knowledgeable friend, not a consultant
- Paragraphs short: 2-4 sentences each, never a wall of text
- Use a short bulleted or numbered list where the content is genuinely a list (steps, options, examples) — don't force one where the content is really just prose
- No em dashes. No AI-vocabulary filler: "delve," "boasts," "testament to," "crucial," "vibrant," "underscore," "elevate," "tapestry," "rich cultural heritage"
- No vague attribution ("experts say," "studies show") — if you reference something specific and real (a named scheme, a named technique, a named place), name it plainly; if you're not certain of a specific number or statistic, don't state one as fact
- Never fabricate statistics, dates, or figures. Concrete, specific, and true beats vague-but-impressive — this is what actually earns a reader's trust (the "trustworthy" half of writing content search engines and readers both treat as credible)
- If a topic asks you to reference a specific ${BRAND.name} feature, only describe capabilities that topic actually names — never invent a button, setting, resolution requirement, or sub-feature that wasn't given to you. Readers will look for exactly what you describe; a plausible-sounding but fake detail is worse than a shorter, accurate one
- Ground claims in specific, checkable detail (a named technique, a real place, a concrete number when you're sure of it) rather than generic claims — specificity is itself the evidence of real expertise, not a separate thing to add on top
- Naturally use a few closely-related terms and phrasings for the main topic where they'd genuinely occur in speech (e.g. a pricing post might naturally also say "cost," "margin," "selling price" — not as a checklist, just how a knowledgeable person actually talks about the topic), instead of repeating one exact phrase mechanically
- Close with one specific, concrete next step the reader can actually take today — not a vague "start today!" line

Respond with ONLY a JSON object, no markdown fences, no preamble, exactly these keys:
{
  "title": "the headline, per the standard above",
  "summary": "one sentence, under 20 words, for a list preview",
  "content": "4-6 paragraphs separated by blank lines (\\n\\n), short paragraphs per the standard above. Structure it into 2-4 sections using a paragraph that is ONLY '## Section Title' (sentence case, no markdown bold, no colon-explainer) immediately before each section's paragraphs. The opening paragraph before the first heading has no heading. Use a bulleted list (lines starting with '- ') inside a section where genuinely appropriate.",
  "imageBrief": "one plain sentence describing a real, photographable scene for this post's header image — a specific craft, object, or moment, not an abstract concept. E.g. 'A weaver's hands guiding thread through a wooden handloom, close up' — not 'a symbol of tradition and progress'"
}`

const TRANSLATION_SYSTEM_PROMPT = `Translate the given JSON blog post fields into the requested language. Keep the same meaning, tone, and paragraph structure exactly, including any paragraph that is only "## Section Title" (translate the heading text but keep the "## " prefix) and any bulleted list (keep the "- " prefix on each line). Respond with ONLY a JSON object with the same keys (title, summary, content), no markdown fences, no preamble.`

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// A first real run (firing all 22 translation calls at once via
// Promise.allSettled) hit provider rate limits hard: 21 of 22 failed, only
// 1 succeeded. callAI now retries once on anything that looks like a rate
// limit, and the caller below runs translations in small batches instead
// of all at once — see the batched loop further down.
async function callAI(system: string, user: string, label: string): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 3072,
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
    const res = await groqClient.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      max_tokens: 3072,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    })
    return res.choices[0]?.message?.content ?? null
  } catch (groqErr) {
    const message = groqErr instanceof Error ? groqErr.message : String(groqErr)
    console.error(`[daily-blog] ${label}: Groq fallback also failed:`, message)
    return null
  }
}

function parseJsonResponse(raw: string, label: string): { title: string; summary: string; content: string; imageBrief?: string } | null {
  try {
    const cleaned = raw.replace(/^```json\s*|```\s*$/g, '').trim()
    const parsed = JSON.parse(cleaned)
    if (parsed.title && parsed.summary && parsed.content) return parsed
    console.error(`[daily-blog] ${label}: parsed JSON missing required keys:`, cleaned.slice(0, 200))
    return null
  } catch {
    console.error(`[daily-blog] ${label}: response was not valid JSON:`, raw.slice(0, 200))
    return null
  }
}

// Best-effort — a post with no image is far better than a post that never
// publishes because image generation had a bad day. Every failure mode here
// (all providers down, storage upload error) is swallowed and logged rather
// than propagated.
async function generateAndStoreHeaderImage(imageBrief: string, slug: string): Promise<string | null> {
  if (!supabaseAdmin) return null
  try {
    const { imageDataUrl } = await generateImage({
      prompt: `${imageBrief}, editorial photography style, natural light, no text, no watermark, suitable as a blog header image`,
    })
    const blob = await (await fetch(imageDataUrl)).blob()
    const path = `${slug}.png`
    const { error: uploadError } = await supabaseAdmin.storage.from('blog-images').upload(path, blob, { contentType: 'image/png', upsert: true })
    if (uploadError) {
      console.error('[daily-blog] header image upload failed:', uploadError.message)
      return null
    }
    return supabaseAdmin.storage.from('blog-images').getPublicUrl(path).data.publicUrl
  } catch (err) {
    if (err instanceof AllProvidersFailedError) {
      console.error('[daily-blog] header image generation: all providers failed:', err.attempts)
    } else {
      console.error('[daily-blog] header image generation failed:', err)
    }
    return null
  }
}

export type DailyBlogResult =
  | { status: 'skipped' | 'already-published' | 'not-configured'; reason?: string; slug?: string }
  | { status: 'error'; error: string; httpStatus: number }
  | { status: 'published'; slug: string; title: string; hasImage: boolean; translated: number; failed: string[] }

export async function runDailyBlog(): Promise<DailyBlogResult> {
  if (!supabaseAdmin) {
    return { status: 'not-configured', reason: 'missing service role key' }
  }

  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10)
  const topic = todaysTopic(today)
  const slug = `${topic.slugBase}-${dateStr}`

  const { data: existing } = await supabaseAdmin.from('blogs').select('slug').eq('slug', slug).maybeSingle()
  if (existing) {
    return { status: 'already-published', slug }
  }

  const raw = await callAI(CONTENT_SYSTEM_PROMPT, `Write today's post about: ${topic.brief}`, 'en-content')
  const post = raw ? parseJsonResponse(raw, 'en-content') : null
  if (!post) {
    return { status: 'error', error: 'AI content generation failed for both providers.', httpStatus: 502 }
  }

  const imageUrl = post.imageBrief ? await generateAndStoreHeaderImage(post.imageBrief, slug) : null

  const { error: insertError } = await supabaseAdmin.from('blogs').insert({
    slug, title: post.title, summary: post.summary, content: post.content, category: topic.category, image_url: imageUrl,
  })
  if (insertError) {
    return { status: 'error', error: `Failed to save post: ${insertError.message}`, httpStatus: 500 }
  }

  // Translate in small batches rather than all 22 at once — firing every
  // request simultaneously hit provider rate limits hard on the first real
  // run (21 of 22 failed). Batches of 4 with a pause between them stays
  // well inside the 300s function budget while giving each request room.
  const otherLanguages = LANGUAGES.filter((l) => l.id !== 'en')
  const BATCH_SIZE = 4
  const translatedOk: string[] = []
  const failed: string[] = []

  for (let i = 0; i < otherLanguages.length; i += BATCH_SIZE) {
    const batch = otherLanguages.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (lang) => {
        const raw = await callAI(
          TRANSLATION_SYSTEM_PROMPT,
          `Translate into ${lang.name}: ${JSON.stringify({ title: post.title, summary: post.summary, content: post.content })}`,
          `translate-${lang.id}`
        )
        const translated = raw ? parseJsonResponse(raw, `translate-${lang.id}`) : null
        if (!translated) throw new Error(`no usable translation`)
        const { error } = await supabaseAdmin!.from('blog_translations').upsert(
          { blog_slug: slug, language: lang.id, title: translated.title, summary: translated.summary, content: translated.content },
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
    if (i + BATCH_SIZE < otherLanguages.length) await sleep(1500)
  }

  return { status: 'published', slug, title: post.title, hasImage: !!imageUrl, translated: translatedOk.length, failed }
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

  const result = await runDailyBlog()
  if (result.status === 'error') {
    return NextResponse.json({ error: result.error }, { status: result.httpStatus })
  }
  if (result.status === 'not-configured') {
    return NextResponse.json({ error: 'Daily blog cron is not set up yet (missing service role key).' }, { status: 503 })
  }
  return NextResponse.json(result)
}
