import { NextRequest, NextResponse } from 'next/server'
import { readJsonObject } from '@/lib/readJson'
import { requireUser } from '@/lib/requireUser'
import { isRateLimited, userKey } from '@/lib/rateLimit'
import { generateImage, AllProvidersFailedError } from '@/lib/imageProviders'
import { directPhotoshoot } from '@/lib/artDirector'

const PRESET_PROMPTS: Record<string, string> = {
  studio: 'clean white studio background, professional product photography, soft even lighting, catalogue style',
  heritage: 'traditional Indian heritage setting, natural materials, warm ambient light, cultural backdrop',
  festival: 'festive Indian setting, golden hour lighting, marigold flowers, celebratory atmosphere',
  story: 'handcraft lifestyle photography, outdoor natural light, artisan workshop setting, documentary style',
  premium: 'high-end commercial photography, dramatic studio lighting, luxury product presentation',
  fashion: 'Indian fashion editorial photography, model wearing the garment, professional fashion shoot, elegant pose',
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

    const { productName, material, preset, colorHint, refineNote, refImageDataUrl } = await readJsonObject(request)

    if (!productName || typeof productName !== 'string') {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }

    const styleDesc = typeof preset === 'string' && Object.hasOwn(PRESET_PROMPTS, preset)
      ? PRESET_PROMPTS[preset]
      : PRESET_PROMPTS.studio
    // colorHint comes from the actual uploaded reference photo (detected client-side)
    // and is folded into the text prompt even for providers that can't take the
    // reference image itself, so it still nudges plain text-to-image generation.
    const colorDesc = colorHint && typeof colorHint === 'string' ? `, predominantly ${colorHint} in colour` : ''
    const refineDesc = refineNote && typeof refineNote === 'string' && refineNote.trim() ? `, ${refineNote.trim()}` : ''
    const prompt = `${productName}${typeof material === 'string' && material.trim() ? `, made of ${material.trim()}` : ''}${colorDesc}, ${styleDesc}${refineDesc}, professional photography, high quality, detailed, no text, no watermark`

    const refImage = typeof refImageDataUrl === 'string' ? refImageDataUrl : undefined
    // Gemini studies the real photo and writes a precise prompt so the
    // generated shot shows this product, not a generic one. Falls back to
    // the template prompt above if Gemini is unavailable.
    const directed = await directPhotoshoot({
      productName,
      material: typeof material === 'string' ? material.trim() : undefined,
      scene: styleDesc,
      refineNote: typeof refineNote === 'string' ? refineNote.trim() || undefined : undefined,
      refImageDataUrl: refImage,
    })
    const finalPrompt = directed ? `${directed}${colorDesc}, professional product photography, high quality, no text, no watermark` : prompt

    try {
      const { imageDataUrl } = await generateImage({ prompt: finalPrompt, refImageDataUrl: refImage })
      return NextResponse.json({ imageDataUrl, prompt: finalPrompt, promptBy: directed ? 'gemini' : 'template' })
    } catch (err) {
      if (err instanceof AllProvidersFailedError) {
        console.error('All image providers failed:', err.attempts)
        return NextResponse.json(
          { error: 'Photoshoot generation is temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        )
      }
      throw err
    }
  } catch (error) {
    console.error('Photoshoot route error:', error)
    return NextResponse.json({ error: 'Photoshoot generation is unavailable. Please try again.' }, { status: 500 })
  }
}
