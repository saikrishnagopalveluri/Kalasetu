import { geminiImage } from './gemini'

// Multi-provider image generation with automatic fallback. Every provider
// below has a free tier (see docs/image-api-setup-guide for signup steps).
// generateImage() tries them in order and moves to the next one on ANY
// failure — quota exhausted, rate limited, misconfigured, or down — so a
// single provider running out never surfaces as a failure to the artisan.

export type GenerateImageOptions = {
  prompt: string
  // data:image/...;base64,... — Gemini (Nano Banana) and Hugging Face use
  // this as the reference photo. Other providers ignore it and generate
  // from the prompt alone rather than failing outright.
  refImageDataUrl?: string
}

export type GenerateImageResult = {
  imageDataUrl: string
  provider: string
}

class ProviderError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export class AllProvidersFailedError extends Error {
  constructor(public attempts: { provider: string; error: string }[]) {
    super('All image providers failed or are unconfigured.')
  }
}

function dataUrlToBase64(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/)
  return match ? match[1] : null
}

// ─── Hugging Face ──────────────────────────────────────────────────────
// Free tier: ~$0.10/month in credits, resets monthly. Cold models commonly
// answer the first request with 503 + estimated_time rather than serving
// it, so we retry once, waiting however long HF says the model needs.
async function generateWithHuggingFace({ prompt, refImageDataUrl }: GenerateImageOptions): Promise<GenerateImageResult> {
  const apiKey = process.env.HF_API_KEY
  if (!apiKey) throw new ProviderError('not configured', 503)

  const model = 'stabilityai/stable-diffusion-3-medium-diffusers'
  const endpoint = `https://router.huggingface.co/hf-inference/models/${model}`
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

  const refBase64 = refImageDataUrl ? dataUrlToBase64(refImageDataUrl) : null
  if (refBase64) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        inputs: refBase64,
        parameters: { prompt, strength: 0.55, num_inference_steps: 30, guidance_scale: 7.5 },
      }),
    })
    if (res.ok) {
      const buf = await res.arrayBuffer()
      return { imageDataUrl: `data:image/png;base64,${Buffer.from(buf).toString('base64')}`, provider: 'huggingface' }
    }
    if (res.status === 402) throw new ProviderError('quota exceeded', 402)
    // Model/endpoint rejected image-to-image for this input — fall through
    // to plain text-to-image below rather than giving up on this provider.
  }

  const MAX_ATTEMPTS = 2
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inputs: prompt, parameters: { num_inference_steps: 30, guidance_scale: 7.5 } }),
    })
    if (res.ok) {
      const buf = await res.arrayBuffer()
      return { imageDataUrl: `data:image/png;base64,${Buffer.from(buf).toString('base64')}`, provider: 'huggingface' }
    }
    const errText = await res.text()
    if (res.status === 503 && attempt < MAX_ATTEMPTS) {
      let waitSeconds = 6
      try {
        const parsed = JSON.parse(errText)
        if (typeof parsed.estimated_time === 'number') waitSeconds = Math.min(parsed.estimated_time, 15)
      } catch { /* not JSON, use the default wait */ }
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000))
      continue
    }
    throw new ProviderError(errText, res.status)
  }
  throw new ProviderError('exhausted retries', 503)
}

// ─── Cloudflare Workers AI ─────────────────────────────────────────────
// Free tier: 10,000 Neurons/day, resets daily. FLUX Schnell costs ~19
// Neurons/image — roughly 500 free images/day, the strongest tier here.
async function generateWithCloudflare({ prompt }: GenerateImageOptions): Promise<GenerateImageResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  if (!accountId || !apiToken) throw new ProviderError('not configured', 503)

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    // 8 is FLUX Schnell's maximum: noticeably sharper than 6 for the same
    // free-tier cost class.
    body: JSON.stringify({ prompt, steps: 8 }),
  })
  if (!res.ok) throw new ProviderError(await res.text(), res.status)

  const json = await res.json()
  const base64 = json?.result?.image
  if (!base64 || typeof base64 !== 'string') throw new ProviderError('unexpected response shape', 502)
  return { imageDataUrl: `data:image/png;base64,${base64}`, provider: 'cloudflare' }
}

// ─── Pixazo ─────────────────────────────────────────────────────────────
// Free tier: preview access, ~60 req/min. Pixazo is a young platform with
// thin public API docs, so this request shape is a best-effort guess at
// their REST convention — if it 4xx's on the first real call, open
// pixazo.ai's dashboard/API reference, compare the example request there
// against this function, and adjust. It's placed after the two
// well-documented providers for exactly this reason.
async function generateWithPixazo({ prompt }: GenerateImageOptions): Promise<GenerateImageResult> {
  const apiKey = process.env.PIXAZO_API_KEY
  if (!apiKey) throw new ProviderError('not configured', 503)

  const res = await fetch('https://api.pixazo.ai/v1/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  if (!res.ok) throw new ProviderError(await res.text(), res.status)

  const contentType = res.headers.get('content-type') || ''
  if (contentType.startsWith('image/')) {
    const buf = await res.arrayBuffer()
    return { imageDataUrl: `data:${contentType};base64,${Buffer.from(buf).toString('base64')}`, provider: 'pixazo' }
  }
  const json = await res.json()
  const url = json?.image_url ?? json?.url ?? json?.data?.[0]?.url
  const base64 = json?.image_base64 ?? json?.b64_json
  if (typeof base64 === 'string') {
    return { imageDataUrl: `data:image/png;base64,${base64}`, provider: 'pixazo' }
  }
  if (typeof url === 'string') {
    const imgRes = await fetch(url)
    const buf = await imgRes.arrayBuffer()
    return { imageDataUrl: `data:image/png;base64,${Buffer.from(buf).toString('base64')}`, provider: 'pixazo' }
  }
  throw new ProviderError('unexpected response shape', 502)
}

// ─── Stability AI ───────────────────────────────────────────────────────
// One-time trial: 25 credits on signup. Kept in the automatic chain since
// exhausting it with no card on file just makes it fail closed (moves to
// Pollinations below) rather than charging anything — but if a card is
// ever added to this account, pull it out of the automatic chain.
async function generateWithStability({ prompt }: GenerateImageOptions): Promise<GenerateImageResult> {
  const apiKey = process.env.STABILITY_API_KEY
  if (!apiKey) throw new ProviderError('not configured', 503)

  const form = new FormData()
  form.append('prompt', prompt)
  form.append('output_format', 'png')

  const res = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'image/*' },
    body: form,
  })
  if (!res.ok) throw new ProviderError(await res.text(), res.status)

  const buf = await res.arrayBuffer()
  return { imageDataUrl: `data:image/png;base64,${Buffer.from(buf).toString('base64')}`, provider: 'stability' }
}

// ─── Pollinations.ai ─────────────────────────────────────────────────────
// No key required, works immediately — the guaranteed last resort so the
// chain never fully dead-ends even if every keyed provider is down.
async function generateWithPollinations({ prompt }: GenerateImageOptions): Promise<GenerateImageResult> {
  const token = process.env.POLLINATIONS_API_TOKEN
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&model=flux&seed=${Math.floor(Math.random() * 1_000_000)}`
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) throw new ProviderError(await res.text(), res.status)

  const buf = await res.arrayBuffer()
  return { imageDataUrl: `data:image/png;base64,${Buffer.from(buf).toString('base64')}`, provider: 'pollinations' }
}

// ─── Google Nano Banana (Gemini image) ──────────────────────────────────
// Primary. Unlike the providers below, it edits the artisan's real photo
// and keeps the product itself unchanged, which matters for handmade goods.
async function generateWithGemini(opts: GenerateImageOptions): Promise<GenerateImageResult> {
  if (!process.env.GEMINI_API_KEY) throw new ProviderError('not configured', 503)
  return geminiImage(opts)
}

const PROVIDERS: { name: string; run: (opts: GenerateImageOptions) => Promise<GenerateImageResult> }[] = [
  { name: 'gemini', run: generateWithGemini },
  { name: 'huggingface', run: generateWithHuggingFace },
  { name: 'cloudflare', run: generateWithCloudflare },
  { name: 'pixazo', run: generateWithPixazo },
  { name: 'stability', run: generateWithStability },
  { name: 'pollinations', run: generateWithPollinations },
]

export async function generateImage(opts: GenerateImageOptions): Promise<GenerateImageResult> {
  const attempts: { provider: string; error: string }[] = []

  for (const provider of PROVIDERS) {
    try {
      return await provider.run(opts)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[imageProviders] ${provider.name} failed:`, message)
      attempts.push({ provider: provider.name, error: message })
    }
  }

  throw new AllProvidersFailedError(attempts)
}
