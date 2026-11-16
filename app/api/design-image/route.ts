import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/requireUser'
import { isRateLimited, userKey } from '@/lib/rateLimit'
import { generateImage, AllProvidersFailedError } from '@/lib/imageProviders'

// Visual language per inspiration theme — feeds the image model, kept separate
// from the text prompt (app/api/ai/route.ts, mode "design_inspiration") which
// generates the idea/story/direction in words.
const THEME_VISUALS: Record<string, string> = {
  nature: 'inspired by Indian flora and fauna — lotus blooms, peacock feathers, paisley leaf forms, flowing river patterns',
  temples: 'inspired by South Indian temple architecture — gopuram silhouettes, stone relief carving, temple pillar motifs',
  history: 'inspired by historic Indian decorative traditions — Mughal inlay work, Chola bronze detailing, Maratha court ornament',
  mythology: 'inspired by Indian mythological imagery — celestial symbolism, folk-tale creatures, epic narrative scenes, temple mural style',
  culture: 'inspired by regional Indian festival colours, textile traditions and folk-art patterns',
  geography: 'inspired by Indian landscapes — Himalayan ridgelines, coastal palm groves, desert dune curves, terraced green fields',
  motifs: 'inspired by classic Indian decorative motifs — paisley (kairi), rangoli geometric patterns, block-print borders',
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok || !auth.userId) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }
    // Image generation is the most expensive call class here — a tighter
    // cap than the text AI routes.
    if (isRateLimited(userKey(auth.userId), 10, 60_000)) {
      return NextResponse.json({ error: 'Too many requests. Please slow down and try again shortly.' }, { status: 429 })
    }

    const { craftType, theme, notes } = await request.json()

    if (!craftType || typeof craftType !== 'string') {
      return NextResponse.json({ error: 'Craft type is required' }, { status: 400 })
    }

    const visualDesc = THEME_VISUALS[theme] || THEME_VISUALS.motifs
    const notesDesc = notes && typeof notes === 'string' && notes.trim() ? `, ${notes.trim()}` : ''
    const prompt = `A new ${craftType} design concept, ${visualDesc}${notesDesc}, artisan reference sketch, rich detail, professional design mood board style, no text, no watermark`

    try {
      const { imageDataUrl } = await generateImage({ prompt })
      return NextResponse.json({ imageDataUrl, prompt })
    } catch (err) {
      if (err instanceof AllProvidersFailedError) {
        console.error('All image providers failed:', err.attempts)
        return NextResponse.json(
          { error: 'Design image generation is temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        )
      }
      throw err
    }
  } catch (error) {
    console.error('Design image route error:', error)
    return NextResponse.json({ error: 'Design image generation is unavailable. Please try again.' }, { status: 500 })
  }
}
