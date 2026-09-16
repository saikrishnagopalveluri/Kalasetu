import Anthropic from '@anthropic-ai/sdk'
import Groq from 'groq-sdk'
import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/requireUser'
import { LANGUAGE_NAMES } from '@/lib/languages'
import { BRAND } from '@/lib/brand'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null

export type StoryScores = {
  storytelling: number
  clarity: number
  authenticity: number
  craftRelevance: number
  culturalContext: number
  informationalValue: number
  readability: number
  overall: number
  feedback: string | null
}

// Scores the story in whatever language it was written in — never
// translates it first — per the multilingual-blogging requirement that an
// artisan writing in Telugu shouldn't be judged on an English version of
// their own words.
const SYSTEM_PROMPT = `You evaluate a story an Indian artisan has written for ${BRAND.name}'s community section — things like their craft technique, their village, a festival memory, a business journey, or advice for other artisans.

Score it on these dimensions, each 0-10:
- storytelling: does it have a real narrative or personal voice, not just a list of facts?
- clarity: is it easy to follow?
- authenticity: does it read like a real person's own experience, not generic filler?
- craftRelevance: does it actually connect to their craft, trade, or artisan life?
- culturalContext: does it convey real cultural, regional, or traditional context?
- informationalValue: would another artisan or a curious reader learn something real from it?
- readability: is the writing well-paced, not repetitive or rambling?

Then give an "overall" score, 0-10, as your honest holistic judgment (not a mechanical average).

If overall is below 8, write one short, specific, encouraging "feedback" paragraph (2-3 sentences) pointing at ONE concrete thing that would most improve it — never generic ("add more detail"), always specific to what's actually missing from what they wrote. If overall is 8 or above, set feedback to null.

The story may be written in any Indian language, or English. Evaluate it in its own original language — do not translate it first, and do not penalize it for not being in English.

Respond with ONLY a JSON object, no markdown fences, no preamble, exactly these keys:
{"storytelling": 0-10, "clarity": 0-10, "authenticity": 0-10, "craftRelevance": 0-10, "culturalContext": 0-10, "informationalValue": 0-10, "readability": 0-10, "overall": 0-10, "feedback": "string or null"}`

function parseScores(raw: string): StoryScores | null {
  try {
    const parsed = JSON.parse(raw.replace(/^```json\s*|```\s*$/g, '').trim())
    if (typeof parsed.overall !== 'number') return null
    return parsed as StoryScores
  } catch {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

    const { title, content, language } = await request.json()
    if (!title || !content || typeof content !== 'string') {
      return NextResponse.json({ error: 'title and content are required' }, { status: 400 })
    }

    const langNote = language && LANGUAGE_NAMES[language]
      ? `\n\nThis story is written in ${LANGUAGE_NAMES[language]}.`
      : ''
    const userMessage = `Title: ${title}\n\n${content}`

    let raw: string | null = null
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-5', max_tokens: 1024,
        system: SYSTEM_PROMPT + langNote,
        messages: [{ role: 'user', content: userMessage }],
      })
      const block = response.content.find((b) => b.type === 'text')
      raw = block && block.type === 'text' ? block.text : null
    } catch (claudeError) {
      console.error('story-evaluate: Claude failed, falling back to Groq:', claudeError)
      if (groqClient) {
        const groqResponse = await groqClient.chat.completions.create({
          model: 'openai/gpt-oss-120b', max_tokens: 1024,
          messages: [{ role: 'system', content: SYSTEM_PROMPT + langNote }, { role: 'user', content: userMessage }],
        })
        raw = groqResponse.choices[0]?.message?.content ?? null
      }
    }

    const scores = raw ? parseScores(raw) : null
    if (!scores) return NextResponse.json({ error: 'Evaluation failed. Please try again.' }, { status: 502 })

    return NextResponse.json(scores)
  } catch (error) {
    console.error('story-evaluate route error:', error)
    return NextResponse.json({ error: 'AI service unavailable. Please try again.' }, { status: 500 })
  }
}
