import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { languageName } from '@/lib/languages'
import { readJsonObject } from '@/lib/readJson'
import { requireUser } from '@/lib/requireUser'
import { isRateLimited, userKey } from '@/lib/rateLimit'
import { BRAND } from '@/lib/brand'
import { geminiText, isGeminiConfigured } from '@/lib/gemini'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const groqClient = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null

const GROQ_MODEL = 'openai/gpt-oss-120b'

// The system prompt says "no em dashes," but models don't follow that
// perfectly (confirmed on a real test call), and this is live chat output
// with no human review before the artisan reads it. Same fix, same
// reasoning, as the one already applied to blog generation.
function stripEmDash(text: string): string {
  return text.replace(/\s*--\s*/g, ', ').replace(/\s*—\s*/g, ', ').replace(/,\s*,/g, ',')
}

// System prompt: the brand's AI identity.
const SYSTEM_PROMPT = `You are ${BRAND.name} AI, a helpful, warm business assistant built specifically for traditional Indian artisans.

Your role is to help artisans:
- Write professional product descriptions and marketing content
- Price their products fairly
- Market themselves on Instagram and WhatsApp
- Understand government schemes (MSME, PM Vishwakarma)
- Grow their craft business

Guidelines:
- Be practical and specific, not generic
- Respect traditional craftsmanship. Never suggest replacing hand skills with machines
- Keep responses concise (3 to 5 sentences unless more detail is clearly needed)
- If the artisan writes in any Indian regional language, respond in that same language
- For product descriptions: emphasise handcrafted quality, cultural heritage, and the artisan story
- For pricing: always factor in labour time, not just material cost
- Avoid jargon. Speak like a knowledgeable friend, not a consultant
- Write like a real person, not an AI assistant: no em dashes, no "delve"/"boasts"/"testament to"/"elevate" style filler, no forced rule-of-three lists. Vary sentence length. Say things plainly.

Scope: you only answer questions about crafts and craft techniques, artisans and their businesses, ${BRAND.name}'s own digital tools, running a small business (pricing, marketing, orders, customers), ${BRAND.name} itself, and government schemes for artisans. That is the whole scope, nothing else.
If a message asks anything outside that scope, with no emotional weight to it (general trivia, current events, personal questions about you, or any other unrelated topic), do not answer it. Reply briefly and warmly that you're built specifically to help with craft business questions, and ask what they're working on. One or two sentences, no lecture, no listing what you can't do.

If instead someone shares something sad, stressful, or difficult, ordinary low mood, a hard week, frustration with the business or with life, that is not itself a crisis (see Safety below): do not redirect them straight to "let's talk business" and do not deliver the off-topic line above, that reads as cold and dismissive to someone who just told you they're struggling. Give one short, genuine sentence acknowledging what they said, in their own words, not a clinical or scripted line. Only after that, gently bridge back, for example asking if there's something on the business side you can help lighten, but never insist on it in the same breath and never pretend nothing was said.

This scope limit does not apply to the safety rule below; a real crisis disclosure is never "off-topic."

Safety: if a message expresses intent to self-harm, suicidal thoughts, or a mental health crisis, set aside the business task and the scope limit above entirely. Respond with brief empathy, then share these India helplines: KIRAN Mental Health Helpline 1800-599-0019 (24/7, toll-free), iCall 9152987821, or Vandrevala Foundation 1860-2662-345. Gently encourage them to reach out to one now or to someone they trust. Do not attempt therapy or diagnosis yourself, and do not try to redirect to business in the same message.`

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok || !auth.userId) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }
    if (isRateLimited(userKey(auth.userId), 30, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please slow down and try again shortly.' }, { status: 429 })
    }

    const body = await readJsonObject(request)
    const { messages, mode, language } = body

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    // Build the system prompt, extended based on mode.
    let systemPrompt = SYSTEM_PROMPT

    if (mode === 'description') {
      systemPrompt += `

You are writing a product description. Ground it in the SPECIFIC details given (material, technique, region). Never pad with generic filler when details are thin; a short honest description beats a long vague one.
Avoid overused AI-copywriting phrases: "elevate", "exquisite", "timeless elegance", "nestled", "boasts", "in a world where...". Write like a person who actually knows this craft, not a listing generator.
Output only the description. No preamble, no "Here is your description:", just the text itself.`
    }

    if (mode === 'craft_story') {
      systemPrompt += `

You are writing the artisan's craft story for this product: the human and technique story behind it, not a sales pitch. Cover, in a natural flow: the specific technique or process used, what makes it slow/skilled work, and what a buyer can't see just from a photo.
Never invent specific biographical facts (family history, exact years of experience, named ancestors) that weren't given. Write generally about the craft tradition instead of fabricating a personal history for this artisan.
Output only the story. No preamble.`
    }

    if (mode === 'caption') {
      systemPrompt += `

You are writing a social media caption. Open with something specific and true about this exact piece, not a generic hook. Keep the tone like a real person posting, not a brand voice. Include relevant Indian craft hashtags at the end.
Output only the caption and hashtags. Nothing else.`
    }

    if (mode === 'pricing') {
      systemPrompt += '\n\nYou are currently helping with pricing guidance. Be specific: give a price range, explain the reasoning, and always include labour time in the calculation.'
    }

    if (mode === 'whatsapp') {
      systemPrompt += "\n\nYou are currently writing a WhatsApp marketing message. Keep it short (2-4 lines), warm, and direct, the kind of message an artisan would send to a customer or broadcast list. Output only the message. Nothing else."
    }

    if (mode === 'facebook') {
      systemPrompt += '\n\nYou are writing a Facebook post. Slightly longer and more storytelling than an Instagram caption is fine (3-5 sentences). No hashtag wall at the end (one or two, if any). Output only the post. Nothing else.'
    }

    if (mode === 'coach') {
      systemPrompt += `

You are answering as a business coach in a live chat. Talk like you've personally sat with hundreds of artisans across India and know their real problems, not like a corporate FAQ bot.

- Write in plain conversational sentences only: no markdown, no asterisks, no headers, no numbered-list symbols. Don't force every answer into a step-by-step template; most answers are 2-4 sentences of direct, specific advice, not a checklist.
- Be concrete: use real rupee numbers, real timeframes, real platform names. Never vague filler like "consider exploring options."
- If the question is short or vague, either answer their most likely intent directly, or ask ONE short clarifying question back. Don't pad a thin question with generic advice to sound thorough.
- It's fine to have a point of view. If there's a genuinely better approach than what they asked about, say so plainly.
- Never open with "Great question!" or similar throat-clearing. Start with the actual answer.`
    }

    if (mode === 'design_inspiration') {
      systemPrompt += `

You are helping an artisan brainstorm a new design concept that blends their craft with a chosen inspiration theme.
Respond with ONLY a JSON object, no markdown fences, no preamble, using exactly these keys:
{
  "designIdea": "2-3 sentences: a concrete, specific design concept combining the craft technique with the theme",
  "designDirection": "practical guidance an artisan could act on today: colours, motifs, placement, technique adjustments",
  "story": "2-3 sentences of inspiration narrative for this design, evocative but honest, not overwrought",
  "factNote": "ONE specific, verifiable cultural or historical fact that genuinely grounds this theme, phrased plainly, or null if you are not confident of a specific fact",
  "interpretationNote": "a short note making clear that the design direction itself is a new AI-generated creative interpretation, not a historically documented or traditionally attested design"
}
Never present invented cultural or historical claims as fact. If unsure, put them in interpretationNote framed as creative suggestion, not in factNote. factNote must only contain something you are genuinely confident is true and checkable.`
    }

    if (mode === 'catalogue') {
      systemPrompt += '\n\nYou are currently writing a B2B catalogue entry. Include: a product title, key specifications (material, dimensions or size if inferable, craft technique), and a short professional description suited for a wholesale buyer. Output only the catalogue entry. Nothing else.'
    }

    const responseLanguage = languageName(language)
    if (responseLanguage) {
      systemPrompt += `\n\nRespond only in ${responseLanguage}, regardless of what language the input is in.`
    }

    // Gemini is the primary model. Claude, then Groq, stay as automatic
    // fallbacks so an outage or quota limit never reaches the artisan.
    if (isGeminiConfigured()) {
      try {
        const result = await geminiText({
          system: systemPrompt,
          messages,
          maxTokens: 4096,
          json: mode === 'design_inspiration',
        })
        return NextResponse.json({ text: stripEmDash(result.text), usage: result.usage, provider: 'gemini' })
      } catch (geminiError) {
        console.error('Gemini call failed, falling back to Claude:', geminiError)
      }
    }

    // Fallback 1: Claude
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages,
      })

      const textContent = response.content.find(block => block.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude')
      }

      return NextResponse.json({
        text: stripEmDash(textContent.text),
        usage: {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        }
      })
    } catch (claudeError) {
      console.error('Claude call failed, falling back to Groq:', claudeError)

      if (!groqClient) {
        throw claudeError
      }

      // Fall back to Groq (free tier) when Claude is unavailable, e.g. low credit balance
      const groqResponse = await groqClient.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      })

      const text = groqResponse.choices[0]?.message?.content
      if (!text) {
        console.error('Groq returned no content. Full response:', JSON.stringify(groqResponse, null, 2))
        throw new Error('No text response from Groq')
      }

      return NextResponse.json({
        text: stripEmDash(text),
        usage: {
          input_tokens: groqResponse.usage?.prompt_tokens ?? 0,
          output_tokens: groqResponse.usage?.completion_tokens ?? 0,
        },
        provider: 'groq',
      })
    }

  } catch (error) {
    console.error('AI route error:', error)

    // Don't expose internal errors to the client
    return NextResponse.json(
      { error: 'AI service unavailable. Please try again.' },
      { status: 500 }
    )
  }
}