import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  isRateLimited: vi.fn(),
  storyMaybeSingle: vi.fn(),
  cacheMaybeSingle: vi.fn(),
  upsert: vi.fn(),
  anthropicCreate: vi.fn(),
}))

function chain(maybeSingle: ReturnType<typeof vi.fn>) {
  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.eq = () => builder
  builder.maybeSingle = maybeSingle
  return builder
}

vi.mock('@/lib/rateLimit', () => ({
  isRateLimited: mocks.isRateLimited,
  clientKey: () => '1.2.3.4',
}))
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: (table: string) => table === 'stories'
      ? chain(mocks.storyMaybeSingle)
      : { ...chain(mocks.cacheMaybeSingle), upsert: mocks.upsert },
  },
}))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mocks.anthropicCreate }
  },
}))
vi.mock('groq-sdk', () => ({ default: class {} }))

function request(body: unknown) {
  return new NextRequest('http://localhost/api/story-translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const story = { id: 's1', title: 'My loom', content: 'I weave every day.', language: 'en' }

describe('POST /api/story-translate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    delete process.env.GROQ_API_KEY
    mocks.isRateLimited.mockReturnValue(false)
    mocks.storyMaybeSingle.mockResolvedValue({ data: story })
    mocks.cacheMaybeSingle.mockResolvedValue({ data: null })
    mocks.upsert.mockResolvedValue({ error: null })
  })

  it('rate limits by client before any database or AI work', async () => {
    mocks.isRateLimited.mockReturnValue(true)
    const { POST } = await import('@/app/api/story-translate/route')
    const response = await POST(request({ storyId: 's1', language: 'hi' }))
    expect(response.status).toBe(429)
    expect(mocks.storyMaybeSingle).not.toHaveBeenCalled()
  })

  it.each([
    ['malformed JSON', '{bad'],
    ['missing fields', {}],
    ['an unsupported language', { storyId: 's1', language: 'xx' }],
  ])('returns 400 for %s', async (_label, body) => {
    const { POST } = await import('@/app/api/story-translate/route')
    const response = await POST(request(body))
    expect(response.status).toBe(400)
    expect(mocks.anthropicCreate).not.toHaveBeenCalled()
  })

  it('returns 404 for a story that is missing or not published', async () => {
    mocks.storyMaybeSingle.mockResolvedValue({ data: null })
    const { POST } = await import('@/app/api/story-translate/route')
    const response = await POST(request({ storyId: 'draft', language: 'hi' }))
    expect(response.status).toBe(404)
  })

  it('returns the original text when it is already in the requested language', async () => {
    const { POST } = await import('@/app/api/story-translate/route')
    const response = await POST(request({ storyId: 's1', language: 'en' }))
    expect(await response.json()).toEqual({ title: story.title, content: story.content })
    expect(mocks.anthropicCreate).not.toHaveBeenCalled()
  })

  it('serves a cached translation without calling the AI', async () => {
    mocks.cacheMaybeSingle.mockResolvedValue({ data: { title: 'मेरा करघा', content: 'मैं रोज़ बुनता हूँ।' } })
    const { POST } = await import('@/app/api/story-translate/route')
    const response = await POST(request({ storyId: 's1', language: 'hi' }))
    expect(await response.json()).toEqual({ title: 'मेरा करघा', content: 'मैं रोज़ बुनता हूँ।' })
    expect(mocks.anthropicCreate).not.toHaveBeenCalled()
  })

  it('translates, strips code fences, and caches the result', async () => {
    mocks.anthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: '```json\n{"title":"मेरा करघा","content":"मैं रोज़ बुनता हूँ।"}\n```' }],
    })
    const { POST } = await import('@/app/api/story-translate/route')
    const response = await POST(request({ storyId: 's1', language: 'hi' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ title: 'मेरा करघा', content: 'मैं रोज़ बुनता हूँ।' })
    expect(mocks.upsert).toHaveBeenCalledWith(
      { story_id: 's1', language: 'hi', title: 'मेरा करघा', content: 'मैं रोज़ बुनता हूँ।' },
      { onConflict: 'story_id,language' },
    )
  })

  it('returns 502 and caches nothing when the AI output is unusable', async () => {
    mocks.anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: 'Sorry, I cannot help.' }] })
    const { POST } = await import('@/app/api/story-translate/route')
    const response = await POST(request({ storyId: 's1', language: 'hi' }))
    expect(response.status).toBe(502)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
})
