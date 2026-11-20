import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Catalogue translation: the artisan's product details go into the
// catalogue's language, and a bad or missing answer never blanks out or
// invents a product.

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), limited: false }))
vi.mock('@/lib/requireUser', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/rateLimit', () => ({ isRateLimited: () => mocks.limited, userKey: (id: string) => id }))
const groq = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('groq-sdk', () => ({ default: class { chat = { completions: { create: groq.create } } } }))

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

const PRODUCTS = [
  { id: 'p1', name: 'Ikat Saree', material: 'Silk', craft_type: 'Handloom', description: 'Maroon double ikat.', craft_story: null },
  { id: 'p2', name: 'Wooden Toy', material: null, craft_type: 'Carving', description: null, craft_story: 'Made in Kondapalli.' },
]

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  process.env.GEMINI_API_KEY = 'k'
  mocks.limited = false
  mocks.requireUser.mockResolvedValue({ ok: true, userId: 'u1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.GEMINI_API_KEY
})

describe('translateCatalogueProducts', () => {
  it('translates every filled field and keeps empty ones empty', async () => {
    const fetchMock = stubFetch(geminiReply(JSON.stringify([
      { id: 'p1', name: 'ఇక్కత్ చీర', material: 'పట్టు', craft_type: 'చేనేత', description: 'మెరూన్ డబుల్ ఇక్కత్.' },
      { id: 'p2', name: 'చెక్క బొమ్మ', craft_type: 'చెక్కడం', craft_story: 'కొండపల్లిలో తయారైంది.', material: 'invented wood' },
    ])))
    const { translateCatalogueProducts } = await import('@/lib/catalogueTranslate')
    const result = await translateCatalogueProducts(PRODUCTS, 'te')
    expect(result.translated).toBe(true)
    expect(result.products[0]).toEqual({ id: 'p1', name: 'ఇక్కత్ చీర', material: 'పట్టు', craft_type: 'చేనేత', description: 'మెరూన్ డబుల్ ఇక్కత్.', craft_story: null })
    // A field the artisan left empty stays empty, even if the model filled it.
    expect(result.products[1].material).toBeNull()
    expect(result.products[1].description).toBeNull()
    const prompt = JSON.parse((fetchMock.mock.calls[0] as FetchCall)[1].body as string).contents[0].parts[0].text as string
    expect(prompt).toContain('into Telugu')
    expect(prompt).not.toContain('"material":null')
  })

  it('keeps the original text for products or fields the model leaves out or blanks', async () => {
    stubFetch(geminiReply(JSON.stringify({ products: [{ id: 'p1', name: '   ', description: 42 }, { id: 'ghost', name: 'x' }] })))
    const { translateCatalogueProducts } = await import('@/lib/catalogueTranslate')
    const result = await translateCatalogueProducts(PRODUCTS, 'hi')
    expect(result.products).toEqual(PRODUCTS)
    expect(result.translated).toBe(false)
  })

  it('does nothing for English or an unknown language', async () => {
    const fetchMock = stubFetch()
    const { translateCatalogueProducts } = await import('@/lib/catalogueTranslate')
    expect(await translateCatalogueProducts(PRODUCTS, 'en')).toEqual({ products: PRODUCTS, translated: false })
    expect(await translateCatalogueProducts(PRODUCTS, 'klingon')).toEqual({ products: PRODUCTS, translated: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws on malformed JSON so the route can fall back', async () => {
    stubFetch(geminiReply('not json'))
    const { translateCatalogueProducts } = await import('@/lib/catalogueTranslate')
    await expect(translateCatalogueProducts(PRODUCTS, 'te')).rejects.toThrow()
  })
})

describe('sanitizeProducts', () => {
  it('accepts well-formed products and trims to known fields', async () => {
    const { sanitizeProducts } = await import('@/lib/catalogueTranslate')
    expect(sanitizeProducts([{ id: 'a', name: 'X', image_url: 'http://x', price: 9 }])).toEqual([
      { id: 'a', name: 'X', material: null, craft_type: null, description: null, craft_story: null },
    ])
  })

  it.each([
    ['not a list', 'x'],
    ['an empty list', []],
    ['a product without an id', [{ name: 'x' }]],
    ['too many products', Array.from({ length: 41 }, (_, i) => ({ id: String(i) }))],
  ])('rejects %s', async (_label, value) => {
    const { sanitizeProducts } = await import('@/lib/catalogueTranslate')
    expect(sanitizeProducts(value)).toBeNull()
  })
})

describe('POST /api/catalogue-translate', () => {
  const post = (body: unknown) => new NextRequest('http://localhost/api/catalogue-translate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })

  it('translates for a signed-in artisan', async () => {
    stubFetch(geminiReply(JSON.stringify([{ id: 'p1', name: 'इकत साड़ी' }])))
    const { POST } = await import('@/app/api/catalogue-translate/route')
    const res = await POST(post({ language: 'hi', products: [PRODUCTS[0]] }))
    expect(res.status).toBe(200)
    expect((await res.json()).products[0].name).toBe('इकत साड़ी')
  })

  it('rejects signed-out callers, bad input and floods before calling Gemini', async () => {
    const fetchMock = stubFetch()
    const { POST } = await import('@/app/api/catalogue-translate/route')
    expect((await POST(post({ language: 'xx', products: PRODUCTS }))).status).toBe(400)
    expect((await POST(post({ language: 'te', products: [] }))).status).toBe(400)
    mocks.limited = true
    expect((await POST(post({ language: 'te', products: PRODUCTS }))).status).toBe(429)
    mocks.limited = false
    mocks.requireUser.mockResolvedValue({ ok: false, userId: null })
    expect((await POST(post({ language: 'te', products: PRODUCTS }))).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a generic 503 when Gemini fails', async () => {
    stubFetch({ ok: false, status: 503, text: async () => 'overloaded', json: async () => ({}) }, { ok: false, status: 503, text: async () => 'x', json: async () => ({}) })
    const { POST } = await import('@/app/api/catalogue-translate/route')
    const res = await POST(post({ language: 'te', products: PRODUCTS }))
    expect(res.status).toBe(503)
    expect(JSON.stringify(await res.json())).not.toMatch(/overloaded|HTTP/)
  })
})

describe('catalogue translation when Gemini is busy', () => {
  const busy = { ok: false, status: 503, text: async () => 'overloaded', json: async () => ({}) }

  it('uses Groq so the catalogue is still translated', async () => {
    process.env.GROQ_API_KEY = 'q'
    vi.stubGlobal('fetch', vi.fn(async () => busy))
    groq.create.mockResolvedValue({ choices: [{ message: { content: '```json\n' + JSON.stringify([{ id: 'p1', name: 'ఇకత్ చీర', material: 'పట్టు', craft_type: 'చేనేత', description: 'మెరూన్ డబుల్ ఇకత్.' }]) + '\n```' } }] })
    const { translateCatalogueProducts } = await import('@/lib/catalogueTranslate')
    const r = await translateCatalogueProducts(PRODUCTS, 'te')
    expect(r.translated).toBe(true)
    expect(r.products[0]).toMatchObject({ name: 'ఇకత్ చీర', material: 'పట్టు', craft_type: 'చేనేత', description: 'మెరూన్ డబుల్ ఇకత్.' })
    expect(r.products[1].name).toBe('Wooden Toy')
    expect(groq.create.mock.calls[0][0].messages[0].content).toContain('Telugu')
    delete process.env.GROQ_API_KEY
  })

  it('tries a second Gemini model before Groq', async () => {
    process.env.GROQ_API_KEY = 'q'
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(busy)
      .mockResolvedValueOnce(geminiReply(JSON.stringify([{ id: 'p1', name: 'इकत साड़ी' }])))
    vi.stubGlobal('fetch', fetchMock)
    const { translateCatalogueProducts } = await import('@/lib/catalogueTranslate')
    const r = await translateCatalogueProducts(PRODUCTS, 'hi')
    expect(r.products[0].name).toBe('इकत साड़ी')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(groq.create).not.toHaveBeenCalled()
    delete process.env.GROQ_API_KEY
  })
})
