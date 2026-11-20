// Google AI layer: Gemini (text + multimodal), Nano Banana (image editing)
// and Gemma (cheap bulk text), all through the Gemini API with one key.
//
// Server-only. Every call site uses Gemini FIRST and keeps its older
// providers (Claude, then Groq; or the image provider chain) as automatic
// fallbacks, so a Gemini outage or quota limit never reaches the artisan.
//
// Plain fetch against the REST API, no SDK: one less dependency, and the
// tests can stub fetch directly.

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// Text requests walk a list of Gemini models, newest first: the newest
// models are often briefly overloaded (503) or rate limited (429), and an
// older Gemini model answering is better than leaving Google entirely.
// Every id is env-overridable (comma-separated for the text list) so
// models can be changed from Vercel settings without a code change.
const DEFAULT_TEXT_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite', 'gemini-3.8-flash']

function modelList(value: string | undefined, fallback: string[]): string[] {
  const list = (value ?? '').split(',').map((m) => m.trim()).filter(Boolean)
  return list.length > 0 ? list : fallback
}

export const GEMINI_MODELS = {
  get text(): string[] {
    return modelList(process.env.GEMINI_MODEL, DEFAULT_TEXT_MODELS)
  },
  get image() {
    return process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image'
  },
  get gemma() {
    return process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it'
  },
  // Quick structured jobs where a few seconds matter more than depth
  // (writing an image prompt). Flash-Lite answered in 2-6 s in live tests.
  get fast(): string {
    return process.env.GEMINI_FAST_MODEL || 'gemini-3.1-flash-lite'
  },
  get speech(): string[] {
    return modelList(process.env.GEMINI_TTS_MODEL, ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'])
  },
}

// Per model attempt. Short by default so an overloaded model hands over
// to the next one quickly; long-form callers (blog articles) pass more.
const TEXT_TIMEOUT_MS = 25_000
const IMAGE_TIMEOUT_MS = 60_000

// Thinking models spend part of maxOutputTokens on reasoning before they
// write the answer, so a tight cap can come back empty. Extra headroom
// keeps the caller's intended answer length intact.
const THINKING_HEADROOM = 4096

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY)
}

export class GeminiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

type InlineData = { mimeType: string; data: string }
type Part = { text: string } | { inlineData: InlineData }
type Content = { role: 'user' | 'model'; parts: Part[] }

export type ChatMessage = { role: string; content: unknown }

export type GeminiTextOptions = {
  system?: string
  // Either a single user prompt or a chat history in the
  // { role: 'user' | 'assistant', content } shape the app already uses.
  prompt?: string
  messages?: ChatMessage[]
  maxTokens?: number
  json?: boolean
  // A single specific model. Without it, the GEMINI_MODELS.text list is
  // tried in order.
  model?: string
  timeoutMs?: number
}

export type GeminiTextResult = {
  text: string
  usage: { input_tokens: number; output_tokens: number }
  model: string
}

const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/

export function dataUrlToInlineData(dataUrl: string): InlineData | null {
  const match = typeof dataUrl === 'string' ? dataUrl.match(DATA_URL_RE) : null
  return match ? { mimeType: match[1], data: match[2] } : null
}

// Converts the app's message content (a plain string, or Anthropic-style
// content blocks) into Gemini parts. Unknown block types are dropped
// rather than sent through as junk.
function toParts(content: unknown): Part[] {
  if (typeof content === 'string') return content ? [{ text: content }] : []
  if (!Array.isArray(content)) return []
  const parts: Part[] = []
  for (const block of content) {
    if (!block || typeof block !== 'object') continue
    const b = block as Record<string, unknown>
    if (b.type === 'text' && typeof b.text === 'string') {
      parts.push({ text: b.text })
    } else if (b.type === 'image' && b.source && typeof b.source === 'object') {
      const src = b.source as Record<string, unknown>
      if (typeof src.media_type === 'string' && typeof src.data === 'string') {
        parts.push({ inlineData: { mimeType: src.media_type, data: src.data } })
      }
    }
  }
  return parts
}

export function toGeminiContents(messages: ChatMessage[]): Content[] {
  const contents: Content[] = []
  for (const message of messages) {
    if (!message || typeof message !== 'object') continue
    const parts = toParts(message.content)
    if (parts.length === 0) continue
    contents.push({ role: message.role === 'assistant' ? 'model' : 'user', parts })
  }
  return contents
}

// Exported for callers that build their own request body (the voice
// agent's function-calling loop).
export async function callGenerateContent(model: string, body: unknown, timeoutMs: number) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new GeminiError('Gemini is not configured', 503)

  const res = await fetch(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) {
    // The API's error body never leaves the server: it is only logged by
    // the caller, never returned to the client.
    throw new GeminiError(`Gemini ${model} HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`, res.status)
  }
  return res.json()
}

export type GeminiResponse = {
  candidates?: { content?: { parts?: Record<string, unknown>[] }; finishReason?: string }[]
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  promptFeedback?: { blockReason?: string }
}

export function responseParts(json: GeminiResponse): Record<string, unknown>[] {
  if (json.promptFeedback?.blockReason) {
    throw new GeminiError(`Gemini blocked the prompt: ${json.promptFeedback.blockReason}`, 422)
  }
  return json.candidates?.[0]?.content?.parts ?? []
}

export async function geminiText(opts: GeminiTextOptions): Promise<GeminiTextResult> {
  const models = opts.model ? [opts.model] : GEMINI_MODELS.text
  let lastError: unknown
  for (const model of models) {
    try {
      return await geminiTextWithModel(model, opts)
    } catch (err) {
      lastError = err
      // A bad request is our fault and will fail on every model alike.
      if (err instanceof GeminiError && err.status === 400) throw err
      if (models.length > 1) {
        console.error(`Gemini ${model} failed, trying the next Gemini model:`, err instanceof Error ? err.message : err)
      }
    }
  }
  throw lastError
}

async function geminiTextWithModel(model: string, opts: GeminiTextOptions): Promise<GeminiTextResult> {
  const isGemma = model.startsWith('gemma')
  const contents = opts.messages ? toGeminiContents(opts.messages) : []
  if (opts.prompt) contents.push({ role: 'user', parts: [{ text: opts.prompt }] })
  if (contents.length === 0) throw new GeminiError('No content to send', 400)

  const body: Record<string, unknown> = { contents }
  if (opts.system) {
    if (isGemma) {
      // Gemma on the Gemini API rejects systemInstruction, so the
      // instructions go in front of the first user turn instead.
      const first = contents.find((c) => c.role === 'user')
      first?.parts.unshift({ text: `${opts.system}\n\n` })
    } else {
      body.systemInstruction = { parts: [{ text: opts.system }] }
    }
  }
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: (opts.maxTokens ?? 2048) + (isGemma ? 0 : THINKING_HEADROOM),
  }
  if (opts.json && !isGemma) generationConfig.responseMimeType = 'application/json'
  body.generationConfig = generationConfig

  const json = (await callGenerateContent(model, body, opts.timeoutMs ?? TEXT_TIMEOUT_MS)) as GeminiResponse
  const text = responseParts(json)
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text as string)
    .join('')
    .trim()
  if (!text) {
    throw new GeminiError(`Gemini ${model} returned no text (finish: ${json.candidates?.[0]?.finishReason ?? 'unknown'})`, 502)
  }
  return {
    text,
    model,
    usage: {
      input_tokens: json.usageMetadata?.promptTokenCount ?? 0,
      output_tokens: json.usageMetadata?.candidatesTokenCount ?? 0,
    },
  }
}

// Gemma: the cheap model for high-volume, low-stakes text (caption
// variations, translation clean-up). Falls back to the main Gemini model
// if Gemma is unavailable.
export async function gemmaText(opts: Omit<GeminiTextOptions, 'model'>): Promise<GeminiTextResult> {
  try {
    return await geminiText({ ...opts, model: GEMINI_MODELS.gemma })
  } catch (err) {
    console.error('Gemma failed, using Gemini instead:', err instanceof Error ? err.message : err)
    return geminiText(opts)
  }
}

// Nano Banana: edits the artisan's real photo into a new scene. With a
// reference photo it keeps the actual product unchanged; without one it
// generates from the prompt alone.
export async function geminiImage({ prompt, refImageDataUrl }: { prompt: string; refImageDataUrl?: string }): Promise<{ imageDataUrl: string; provider: string }> {
  const ref = refImageDataUrl ? dataUrlToInlineData(refImageDataUrl) : null
  const instruction = ref
    ? `Edit this photo of a handmade product. Keep the product itself exactly as it is: same shape, colours, patterns, proportions and craft details. Do not add, remove or redesign anything on the product. Only change the setting, background and lighting to: ${prompt}`
    : prompt
  const parts: Part[] = ref ? [{ inlineData: ref }, { text: instruction }] : [{ text: instruction }]

  const json = (await callGenerateContent(
    GEMINI_MODELS.image,
    { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } },
    IMAGE_TIMEOUT_MS
  )) as GeminiResponse

  for (const part of responseParts(json)) {
    const inline = (part.inlineData ?? part.inline_data) as { mimeType?: string; mime_type?: string; data?: string } | undefined
    if (inline?.data) {
      return { imageDataUrl: `data:${inline.mimeType ?? inline.mime_type ?? 'image/png'};base64,${inline.data}`, provider: 'gemini' }
    }
  }
  throw new GeminiError('Nano Banana returned no image', 502)
}

// Gemini text-to-speech: speaks the reply aloud in the artisan's language,
// including languages many phones have no built-in voice for. The free
// tier allows only a few requests a minute, so callers must treat a
// failure as "use the device's own voice instead", never as an error.
// Only the words are sent: with a style instruction in front, the speech
// models sometimes read the instruction aloud too (heard live on 20 Nov
// 2026). The language is taken from the text itself. languageName is kept
// in the signature so callers do not change.
// Longest reply read aloud. A detailed answer in an Indian script can pass
// 800 characters; 1,600 covers a full price breakdown.
export const MAX_SPOKEN_CHARS = 1600

export async function geminiSpeech({ text }: { text: string; languageName?: string }): Promise<{ audioDataUrl: string; model: string }> {
  const spoken = text.trim().slice(0, MAX_SPOKEN_CHARS)
  if (!spoken) throw new GeminiError('No text to speak', 400)
  const instruction = spoken
  let lastError: unknown
  for (const model of GEMINI_MODELS.speech) {
    try {
      const json = (await callGenerateContent(model, {
        contents: [{ role: 'user', parts: [{ text: instruction }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      }, 30_000)) as GeminiResponse
      for (const part of responseParts(json)) {
        const inline = part.inlineData as { mimeType?: string; data?: string } | undefined
        if (inline?.data) return { audioDataUrl: `data:${inline.mimeType ?? 'audio/wav'};base64,${inline.data}`, model }
      }
      throw new GeminiError(`Gemini ${model} returned no audio`, 502)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError
}

export type GroundedSource = { title: string; url: string }

// Gemini answering with Google Search grounding: a live answer plus the
// web pages it came from, so the artisan can check every claim. Needs a
// Gemini API project with billing enabled (the free tier has no grounding
// quota); callers treat any failure as "no live answer" and fall back.
export async function geminiGrounded({ prompt, system, timeoutMs = 25_000 }: { prompt: string; system?: string; timeoutMs?: number }): Promise<{ text: string; sources: GroundedSource[]; model: string }> {
  let lastError: unknown
  for (const model of [GEMINI_MODELS.fast, ...GEMINI_MODELS.text.filter((m) => m !== GEMINI_MODELS.fast)]) {
    try {
      const body: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 2048 },
      }
      if (system) body.systemInstruction = { parts: [{ text: system }] }
      const json = (await callGenerateContent(model, body, timeoutMs)) as GeminiResponse & {
        candidates?: { groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } }[]
      }
      const text = responseParts(json).filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text as string).join('').trim()
      if (!text) throw new GeminiError(`Gemini ${model} returned no grounded text`, 502)
      const seen = new Set<string>()
      const sources: GroundedSource[] = []
      for (const chunk of json.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
        const url = chunk.web?.uri
        if (!url || seen.has(url) || !/^https:\/\//.test(url)) continue
        seen.add(url)
        sources.push({ title: (chunk.web?.title || new URL(url).hostname).slice(0, 120), url })
        if (sources.length === 5) break
      }
      return { text, sources, model }
    } catch (err) {
      lastError = err
      // Quota errors are the same on every model of one project: stop early.
      if (err instanceof GeminiError && (err.status === 429 || err.status === 403)) break
    }
  }
  throw lastError
}
