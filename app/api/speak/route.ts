import { NextRequest, NextResponse } from 'next/server'
import { readJsonObject } from '@/lib/readJson'
import { requireUser } from '@/lib/requireUser'
import { isRateLimited, userKey } from '@/lib/rateLimit'
import { geminiSpeech, isGeminiConfigured } from '@/lib/gemini'
import { languageName } from '@/lib/languages'

export const maxDuration = 60

// Turns the agent's reply into natural speech with Gemini TTS. The client
// treats any failure as "use the device's own voice", so errors here are
// expected (the free tier allows only a few requests a minute) and kept
// generic.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }
    if (isRateLimited(userKey(`speak:${auth.userId ?? 'anonymous'}`), 10, 60_000)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }
    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: 'Speech unavailable' }, { status: 503 })
    }
    const { text, language } = await readJsonObject(request)
    if (typeof text !== 'string' || !text.trim() || text.length > 800) {
      return NextResponse.json({ error: 'Text is required (max 800 characters)' }, { status: 400 })
    }
    const { audioDataUrl } = await geminiSpeech({ text, languageName: languageName(language) })
    return NextResponse.json({ audioDataUrl })
  } catch (error) {
    console.error('Speak route error:', error)
    return NextResponse.json({ error: 'Speech unavailable' }, { status: 503 })
  }
}
