import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Gemini "art director": writes precise image prompts from the artisan's
// real photo (photoshoot) or design brief, and falls back to the template
// prompt whenever Gemini is unavailable.

const mocks = vi.hoisted(() => ({ generateImage: vi.fn(), requireUser: vi.fn() }))
vi.mock('@/lib/imageProviders', () => ({
  generateImage: mocks.generateImage,
  AllProvidersFailedError: class extends Error {},
}))
vi.mock('@/lib/requireUser', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/rateLimit', () => ({ isRateLimited: () => false, userKey: (id: string) => id }))

type FetchCall = [string, RequestInit]
const geminiReply = (text: string) => ({
  ok: true, status: 200, text: async () => '',
  json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
})
function stubFetch(...responses: unknown[]) {
  const fetchMock = vi.fn()
  for (const r of responses) fetchMock.mockResolvedValueOnce(r)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const bodyOf = (f: ReturnType<typeof vi.fn>) => JSON.parse((f.mock.calls[0] as FetchCall)[1].body as string)

const DIRECTED = 'A dark charcoal-grey handmade terracotta bowl with a thick rim and a flat side handle, on a wooden table with marigolds, golden hour, 50mm lens'

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  process.env.GEMINI_API_KEY = 'k'
  delete process.env.GEMINI_FAST_MODEL
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.requireUser.mockResolvedValue({ ok: true, userId: 'u1' })
  mocks.generateImage.mockResolvedValue({ imageDataUrl: 'data:image/png;base64,IMG', provider: 'cloudflare' })
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.GEMINI_API_KEY
})

describe('directPhotoshoot', () => {
  it('sends the real photo to the fast Gemini model and returns a cleaned prompt', async () => {
    const fetchMock = stubFetch(geminiReply(`Prompt: "${DIRECTED}"`))
    const { directPhotoshoot } = await import('@/lib/artDirector')
    const prompt = await directPhotoshoot({ productName: 'Clay pot', material: 'terracotta', scene: 'festive', refImageDataUrl: 'data:image/jpeg;base64,PHOTO' })
    expect(prompt).toBe(DIRECTED)
    expect((fetchMock.mock.calls[0] as FetchCall)[0]).toContain('/models/gemini-3.1-flash-lite:generateContent')
    const parts = bodyOf(fetchMock).contents[0].parts
    expect(parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'PHOTO' } })
    expect(parts[1].text).toContain('The attached photo shows the REAL product')
    expect(parts[1].text).toContain('Clay pot, made of terracotta')
  })

  it('works from the details alone when there is no photo', async () => {
    const fetchMock = stubFetch(geminiReply(DIRECTED))
    const { directPhotoshoot } = await import('@/lib/artDirector')
    await directPhotoshoot({ productName: 'Saree', scene: 'studio', refineNote: 'warmer light' })
    const text = bodyOf(fetchMock).contents[0].parts[0].text
    expect(text).toContain('There is no photo')
    expect(text).toContain("Artisan's request: warmer light")
  })

  it('returns null (template fallback) when Gemini fails, answers too briefly, or has no key', async () => {
    const { directPhotoshoot } = await import('@/lib/artDirector')
    stubFetch({ ok: false, status: 503, text: async () => 'busy', json: async () => ({}) })
    expect(await directPhotoshoot({ productName: 'x', scene: 's' })).toBeNull()
    stubFetch(geminiReply('ok'))
    expect(await directPhotoshoot({ productName: 'x', scene: 's' })).toBeNull()
    delete process.env.GEMINI_API_KEY
    const fetchMock = stubFetch()
    expect(await directPhotoshoot({ productName: 'x', scene: 's' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('directDesign', () => {
  it('asks for named motifs, a palette and craft-true details', async () => {
    const fetchMock = stubFetch(geminiReply('An ikat saree with gopuram silhouettes in crimson, turmeric and forest green, soft feathered ikat edges'))
    const { directDesign } = await import('@/lib/artDirector')
    const prompt = await directDesign({ craftType: 'ikat saree', themeVisual: 'temple architecture', notes: 'for a wedding' })
    expect(prompt).toContain('gopuram')
    const text = bodyOf(fetchMock).contents[0].parts[0].text
    expect(text).toContain('NEW ikat saree design')
    expect(text).toContain("Artisan's notes: for a wedding")
    expect(text).toMatch(/colour palette/)
  })
})

describe('image routes use the directed prompt', () => {
  const post = (url: string, body: unknown) => new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

  it('photoshoot generates from the Gemini prompt and keeps the reference photo', async () => {
    stubFetch(geminiReply(DIRECTED))
    const { POST } = await import('@/app/api/photoshoot/route')
    const res = await POST(post('http://localhost/api/photoshoot', { productName: 'Clay pot', preset: 'festival', colorHint: 'grey', refImageDataUrl: 'data:image/jpeg;base64,PHOTO' }))
    const body = await res.json()
    expect(body.promptBy).toBe('gemini')
    expect(mocks.generateImage).toHaveBeenCalledWith({
      prompt: `${DIRECTED}, predominantly grey in colour, professional product photography, high quality, no text, no watermark`,
      refImageDataUrl: 'data:image/jpeg;base64,PHOTO',
    })
  })

  it('photoshoot falls back to the template prompt when Gemini is down', async () => {
    stubFetch({ ok: false, status: 429, text: async () => 'quota', json: async () => ({}) })
    const { POST } = await import('@/app/api/photoshoot/route')
    const body = await (await POST(post('http://localhost/api/photoshoot', { productName: 'Clay pot', preset: 'studio' }))).json()
    expect(body.promptBy).toBe('template')
    expect(mocks.generateImage.mock.calls[0][0].prompt).toMatch(/^Clay pot, .*clean white studio background/)
  })

  it('design image uses the Gemini design brief', async () => {
    stubFetch(geminiReply('A Channapatna toy elephant in lacquered red, yellow and green with rounded turned forms'))
    const { POST } = await import('@/app/api/design-image/route')
    const body = await (await POST(post('http://localhost/api/design-image', { craftType: 'Channapatna toy', theme: 'nature' }))).json()
    expect(body.promptBy).toBe('gemini')
    expect(mocks.generateImage.mock.calls[0][0].prompt).toBe('A Channapatna toy elephant in lacquered red, yellow and green with rounded turned forms, rich detail, no text, no watermark')
  })
})
