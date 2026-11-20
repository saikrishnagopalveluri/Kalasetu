import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// generateImage()'s entire reason to exist is "if one provider is down or
// out of quota, silently move to the next one." That fallback behavior is
// the actual business logic here — everything else is per-provider request
// formatting. These tests mock fetch and env vars to prove the ordering
// and failure-aggregation actually works, without hitting any real API.

const ORIGINAL_ENV = { ...process.env }

function clearProviderEnv() {
  delete process.env.GEMINI_API_KEY
  delete process.env.HF_API_KEY
  delete process.env.CLOUDFLARE_ACCOUNT_ID
  delete process.env.CLOUDFLARE_API_TOKEN
  delete process.env.PIXAZO_API_KEY
  delete process.env.STABILITY_API_KEY
  delete process.env.POLLINATIONS_API_TOKEN
}

function pngResponse() {
  return { ok: true, arrayBuffer: async () => new TextEncoder().encode('fake-png-bytes').buffer } as Response
}

beforeEach(() => {
  clearProviderEnv()
  vi.resetModules()
})
afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
})

describe('generateImage: fallback ordering', () => {
  it('uses the first configured provider when its request succeeds', async () => {
    process.env.HF_API_KEY = 'test-hf-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pngResponse()))

    const { generateImage } = await import('@/lib/imageProviders')
    const result = await generateImage({ prompt: 'a test prompt' })

    expect(result.provider).toBe('huggingface')
    expect(result.imageDataUrl).toMatch(/^data:image\/png;base64,/)
  })

  it('falls through to the next configured provider when the first fails', async () => {
    process.env.HF_API_KEY = 'test-hf-key'
    process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account'
    process.env.CLOUDFLARE_API_TOKEN = 'test-token'

    const fetchMock = vi.fn()
      // HF: two attempts (its own internal cold-start retry) — fail both with a non-503 so it gives up immediately.
      .mockResolvedValueOnce({ ok: false, status: 402, text: async () => 'quota exceeded' } as Response)
      // Cloudflare: succeeds.
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: { image: 'ZmFrZQ==' } }) } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const { generateImage } = await import('@/lib/imageProviders')
    const result = await generateImage({ prompt: 'a test prompt' })

    expect(result.provider).toBe('cloudflare')
  })

  it('skips providers with no configured API key entirely (no network call made for them)', async () => {
    // Nothing configured except Pollinations, which needs no key.
    const fetchMock = vi.fn().mockResolvedValue(pngResponse())
    vi.stubGlobal('fetch', fetchMock)

    const { generateImage } = await import('@/lib/imageProviders')
    const result = await generateImage({ prompt: 'a test prompt' })

    expect(result.provider).toBe('pollinations')
    // Exactly one fetch call — proof the four unconfigured providers never
    // attempted a network request at all, rather than failing fast for
    // some other reason.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws AllProvidersFailedError with one attempt entry per provider when every provider fails', async () => {
    process.env.HF_API_KEY = 'test-hf-key'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'server error' } as Response))

    const { generateImage, AllProvidersFailedError } = await import('@/lib/imageProviders')
    await expect(generateImage({ prompt: 'a test prompt' })).rejects.toBeInstanceOf(AllProvidersFailedError)

    try {
      await generateImage({ prompt: 'a test prompt' })
    } catch (err) {
      expect(err).toBeInstanceOf(AllProvidersFailedError)
      const attempts = (err as InstanceType<typeof AllProvidersFailedError>).attempts
      expect(attempts.map((a) => a.provider)).toEqual(['gemini', 'huggingface', 'cloudflare', 'pixazo', 'stability', 'pollinations'])
    }
  })
})

  

describe('generateImage: provider retries and input fallback', () => {
  it('retries Hugging Face once after a cold-model 503', async () => {
    process.env.HF_API_KEY = 'test-hf-key'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ estimated_time: 0 }),
      } as Response)
      .mockResolvedValueOnce(pngResponse())
    vi.stubGlobal('fetch', fetchMock)

    const { generateImage } = await import('@/lib/imageProviders')
    const result = await generateImage({ prompt: 'a test prompt' })

    expect(result.provider).toBe('huggingface')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('falls back from rejected image-to-image input to text-to-image on Hugging Face', async () => {
    process.env.HF_API_KEY = 'test-hf-key'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'image input rejected',
      } as Response)
      .mockResolvedValueOnce(pngResponse())
    vi.stubGlobal('fetch', fetchMock)

    const { generateImage } = await import('@/lib/imageProviders')
    const result = await generateImage({
      prompt: 'a test prompt',
      refImageDataUrl: 'data:image/png;base64,ZmFrZQ==',
    })

    expect(result.provider).toBe('huggingface')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstBody = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string)
    expect(firstBody.parameters.prompt).toBe('a test prompt')
    expect(secondBody.inputs).toBe('a test prompt')
  })
})
