// Gemini as "art director" for image generation. The free image models in
// the provider chain only receive text, so given just "Ikat saree, festive
// setting" they invent a different saree. Here Gemini looks at the
// artisan's actual photo (or the design brief) and writes a precise,
// specific prompt, so the generated image stays close to the real product.
//
// Always optional: any failure returns null and the route uses its
// original template prompt, so image generation never gets worse than
// before and never waits long (short timeout, fastest model).

import { geminiText, GEMINI_MODELS, isGeminiConfigured, dataUrlToInlineData } from './gemini'

const ART_DIRECTOR_TIMEOUT_MS = 12_000
const MAX_PROMPT_CHARS = 900

function cleanPrompt(text: string): string | null {
  const cleaned = text
    .replace(/^```[a-z]*\s*|```\s*$/gi, '')
    .replace(/^\s*(prompt|image prompt)\s*:\s*/i, '')
    .replace(/["“”]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned.length >= 20 ? cleaned.slice(0, MAX_PROMPT_CHARS) : null
}

export type PhotoshootBrief = {
  productName: string
  material?: string
  scene: string
  refineNote?: string
  refImageDataUrl?: string
}

export async function directPhotoshoot(brief: PhotoshootBrief): Promise<string | null> {
  if (!isGeminiConfigured()) return null
  const photo = brief.refImageDataUrl ? dataUrlToInlineData(brief.refImageDataUrl) : null
  const instruction = `You are the art director for a product photoshoot of a handmade Indian craft product.
${photo ? 'The attached photo shows the REAL product. Study it closely.' : 'There is no photo, only the details below.'}
Product: ${brief.productName}${brief.material ? `, made of ${brief.material}` : ''}.
Scene: ${brief.scene}.${brief.refineNote ? `\nArtisan's request: ${brief.refineNote}.` : ''}

Write ONE prompt for an image generation model, in English, at most 90 words, that recreates this exact product faithfully in that scene. First describe the product precisely: what it is, shape and proportions, material and texture, exact colours, patterns, motifs, borders and visible handmade details. Then the scene, props, lighting and camera (for example 50mm, shallow depth of field). The product must be the clear hero, fully visible and centred. Do not invent decorations the product does not have. No text, logos or watermarks. Output only the prompt.`

  try {
    const { text } = await geminiText({
      model: GEMINI_MODELS.fast,
      timeoutMs: ART_DIRECTOR_TIMEOUT_MS,
      maxTokens: 400,
      messages: [{
        role: 'user',
        content: photo
          ? [{ type: 'image', source: { type: 'base64', media_type: photo.mimeType, data: photo.data } }, { type: 'text', text: instruction }]
          : instruction,
      }],
    })
    return cleanPrompt(text)
  } catch (err) {
    console.error('artDirector: photoshoot prompt failed, using the template prompt:', err instanceof Error ? err.message : err)
    return null
  }
}

export type DesignBrief = {
  craftType: string
  themeVisual: string
  notes?: string
}

export async function directDesign(brief: DesignBrief): Promise<string | null> {
  if (!isGeminiConfigured()) return null
  const instruction = `You are a design director helping an Indian artisan imagine a NEW ${brief.craftType} design.
Inspiration: ${brief.themeVisual}.${brief.notes ? `\nArtisan's notes: ${brief.notes}.` : ''}

Write ONE prompt for an image generation model, in English, at most 90 words, for a finished ${brief.craftType} piece shown as a clear product concept image. Be concrete: name 2 or 3 specific motifs and where they sit on the piece, a colour palette of 3 to 5 named colours, and details true to how this craft is actually made (for example ikat's soft blurred edges, kalamkari's hand-drawn black outlines, Channapatna's lacquered rounded forms). Mention the composition, background and lighting. No text, logos or watermarks. Output only the prompt.`

  try {
    const { text } = await geminiText({ model: GEMINI_MODELS.fast, timeoutMs: ART_DIRECTOR_TIMEOUT_MS, maxTokens: 400, prompt: instruction })
    return cleanPrompt(text)
  } catch (err) {
    console.error('artDirector: design prompt failed, using the template prompt:', err instanceof Error ? err.message : err)
    return null
  }
}
