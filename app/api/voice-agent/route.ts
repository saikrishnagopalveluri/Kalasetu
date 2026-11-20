import { NextRequest, NextResponse } from 'next/server'
import { readJsonObject } from '@/lib/readJson'
import { requireUser } from '@/lib/requireUser'
import { isRateLimited, userKey } from '@/lib/rateLimit'
import { isGeminiConfigured } from '@/lib/gemini'
import { runVoiceAgent, type AgentTurn } from '@/lib/voiceAgent'
import { createDataSource } from '@/lib/voiceAgentData'

// Up to about 60 seconds of 16 kHz mono WAV, base64-encoded. Vercel caps
// request bodies at 4.5 MB, so this also keeps us well clear of that.
const MAX_AUDIO_BASE64_LENGTH = 3_000_000
const AUDIO_MIME_RE = /^audio\/(wav|x-wav|wave|webm|ogg|mpeg|mp3|mp4|aac|flac)(;.*)?$/
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/

export const maxDuration = 60

function parseHistory(value: unknown): AgentTurn[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((t): t is { role: string; content: string } =>
      Boolean(t) && typeof t === 'object' && typeof (t as { content?: unknown }).content === 'string')
    .slice(-8)
    .map((t) => ({ role: t.role === 'assistant' ? 'assistant' : 'user', content: t.content.slice(0, 2000) }))
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }
    if (isRateLimited(userKey(auth.userId ?? 'anonymous'), 15, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 })
    }
    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: 'The voice assistant is not available right now.' }, { status: 503 })
    }

    const body = await readJsonObject(request)
    let audio: { mimeType: string; data: string } | null = null
    if (body.audio !== undefined && body.audio !== null) {
      const a = body.audio as Record<string, unknown>
      if (
        typeof a !== 'object' ||
        typeof a.mimeType !== 'string' || !AUDIO_MIME_RE.test(a.mimeType) ||
        typeof a.data !== 'string' || a.data.length === 0 ||
        a.data.length > MAX_AUDIO_BASE64_LENGTH || !BASE64_RE.test(a.data)
      ) {
        return NextResponse.json({ error: 'That recording could not be used. Please try again, or type your question.' }, { status: 400 })
      }
      audio = { mimeType: a.mimeType.split(';')[0], data: a.data }
    }
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, 2000) : ''
    if (!audio && !text) {
      return NextResponse.json({ error: 'Please speak or type a question.' }, { status: 400 })
    }

    const result = await runVoiceAgent({
      audio,
      text,
      history: parseHistory(body.history),
      language: typeof body.language === 'string' ? body.language : undefined,
      data: createDataSource(auth.userId),
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('Voice agent route error:', error)
    return NextResponse.json({ error: 'The voice assistant is busy. Please try again in a moment.' }, { status: 503 })
  }
}
