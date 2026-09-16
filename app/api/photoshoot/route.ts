import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/requireUser'
import { generateImage, AllProvidersFailedError } from '@/lib/imageProviders'

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
    if (!auth.ok) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
    }

    const { productName, material, preset, colorHint, refineNote, refImageDataUrl } = await request.json()

    if (!productName || typeof productName !== 'string') {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }

    const styleDesc = PRESET_PROMPTS[preset] || PRESET_PROMPTS.studio
    // colorHint comes from the actual uploaded reference photo (detected client-side)
    // and is folded into the text prompt even for providers that can't take the
    // reference image itself, so it still nudges plain text-to-image generation.
    const colorDesc = colorHint && typeof colorHint === 'string' ? `, predominantly ${colorHint} in colour` : ''
    const refineDesc = refineNote && typeof refineNote === 'string' && refineNote.trim() ? `, ${refineNote.trim()}` : ''
    const prompt = `${productName}${material ? `, made of ${material}` : ''}${colorDesc}, ${styleDesc}${refineDesc}, professional photography, high quality, detailed, no text, no watermark`

    try {
      const { imageDataUrl } = await generateImage({
        prompt,
        refImageDataUrl: typeof refImageDataUrl === 'string' ? refImageDataUrl : undefined,
      })
      return NextResponse.json({ imageDataUrl, prompt })
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
