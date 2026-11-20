import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Covers the Google AI layer (lib/gemini.ts) and that every caller uses
// Gemini first and only falls back to Claude/Groq when Gemini fails.

const mocks = vi.hoisted(() => ({
  anthropicCreate: vi.fn(),
  groqCreate: vi.fn(),
  requireUser: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mocks.anthropicCreate }
  },
}))
vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: mocks.groqCreate } }
  },
}))
vi.mock('@/lib/requireUser', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/rateLimit', () => ({ isRateLimited: () => false, userKey: (id: string) => `user:${id}` }))

type FetchCall = [string, RequestInit]

function geminiReply(text: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7 },
    }),
    text: async () => '',
  }
}

function httpError(status: number, body = 'quota exceeded') {
  return { ok: false, status, json: async () => ({}), text: async () => body }
}

function stubFetch(...responses: unknown[]) {
  const fetchMock = vi.fn()
  for (const r of responses) fetchMock.mockResolvedValueOnce(r)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const sentBody = (fetchMock: ReturnType<typeof vi.fn>, index = 0) =>
  JSON.parse((fetchMock.mock.calls[index] as FetchCall)[1].body as string)
const sentUrl = (fetchMock: ReturnType<typeof vi.fn>, index = 0) => (fetchMock.mock.calls[index] as FetchCall)[0]

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  process.env.GEMINI_API_KEY = 'test-gemini-key'
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
  process.env.GROQ_API_KEY = 'test-groq-key'
  delete process.env.GEMINI_MODEL
  delete process.env.GEMMA_MODEL
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mocks.requireUser.mockResolvedValue({ ok: true, userId: 'user-1' })
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.GEMINI_API_KEY
})

describe('geminiText', () => {
  it('sends the system prompt, chat history and key to the Gemini API', async () => {
    const fetchMock = stubFetch(geminiReply('Namaste'))
    const { geminiText } = await import('@/lib/gemini')
    const result = await geminiText({
      system: 'Be helpful',
      messages: [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
        { role: 'user', content: 'Price my saree' },
      ],
      maxTokens: 500,
    })
    expect(result).toEqual({ text: 'Namaste', model: 'gemini-2.5-flash', usage: { input_tokens: 11, output_tokens: 7 } })
    expect(sentUrl(fetchMock)).toContain('/models/gemini-2.5-flash:generateContent')
    const init = (fetchMock.mock.calls[0] as FetchCall)[1]
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-gemini-key')
    const body = sentBody(fetchMock)
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'Be helpful' }] })
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user'])
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThan(500)
  })

  it('passes product photos through as inline image data', async () => {
    const fetchMock = stubFetch(geminiReply('A blue pot'))
    const { geminiText } = await import('@/lib/gemini')
    await geminiText({
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
          { type: 'text', text: 'Describe this' },
          { type: 'unknown' },
        ],
      }],
    })
    expect(sentBody(fetchMock).contents[0].parts).toEqual([
      { inlineData: { mimeType: 'image/jpeg', data: 'AAAA' } },
      { text: 'Describe this' },
    ])
  })

  it('asks for JSON output when json is set', async () => {
    const fetchMock = stubFetch(geminiReply('{}'))
    const { geminiText } = await import('@/lib/gemini')
    await geminiText({ prompt: 'x', json: true })
    expect(sentBody(fetchMock).generationConfig.responseMimeType).toBe('application/json')
  })

  it('uses the model set in GEMINI_MODEL', async () => {
    process.env.GEMINI_MODEL = 'gemini-next'
    const fetchMock = stubFetch(geminiReply('ok'))
    const { geminiText } = await import('@/lib/gemini')
    await geminiText({ prompt: 'x' })
    expect(sentUrl(fetchMock)).toContain('/models/gemini-next:generateContent')
  })

  it('ignores thought parts and throws on an empty answer', async () => {
    stubFetch({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'thinking...', thought: true }] }, finishReason: 'MAX_TOKENS' }] }),
    })
    const { geminiText } = await import('@/lib/gemini')
    await expect(geminiText({ prompt: 'x' })).rejects.toThrow(/no text/)
  })

  it('throws on HTTP errors and blocked prompts', async () => {
    stubFetch(httpError(429), { ok: true, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) })
    const { geminiText } = await import('@/lib/gemini')
    await expect(geminiText({ prompt: 'x' })).rejects.toMatchObject({ status: 429 })
    await expect(geminiText({ prompt: 'x' })).rejects.toMatchObject({ status: 422 })
  })

  it('refuses to call without a key or without content', async () => {
    const fetchMock = stubFetch()
    const { geminiText } = await import('@/lib/gemini')
    await expect(geminiText({ messages: [] })).rejects.toMatchObject({ status: 400 })
    delete process.env.GEMINI_API_KEY
    await expect(geminiText({ prompt: 'x' })).rejects.toMatchObject({ status: 503 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('gemmaText', () => {
  it('runs on Gemma with the instructions folded into the user turn', async () => {
    const fetchMock = stubFetch(geminiReply('translated'))
    const { gemmaText } = await import('@/lib/gemini')
    const result = await gemmaText({ system: 'Translate to Telugu', prompt: 'Hello' })
    expect(result.model).toBe('gemma-3-27b-it')
    const body = sentBody(fetchMock)
    expect(body.systemInstruction).toBeUndefined()
    expect(body.contents[0].parts.map((p: { text: string }) => p.text)).toEqual(['Translate to Telugu\n\n', 'Hello'])
  })

  it('falls back to Gemini when Gemma fails', async () => {
    const fetchMock = stubFetch(httpError(503), geminiReply('from gemini'))
    const { gemmaText } = await import('@/lib/gemini')
    expect((await gemmaText({ prompt: 'x' })).text).toBe('from gemini')
    expect(sentUrl(fetchMock, 1)).toContain('gemini-2.5-flash')
  })
})

describe('geminiImage (Nano Banana)', () => {
  const imageReply = {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: 'Here you go' }, { inlineData: { mimeType: 'image/png', data: 'IMG' } }] } }] }),
  }

  it('edits the real photo and tells the model to keep the product unchanged', async () => {
    const fetchMock = stubFetch(imageReply)
    const { geminiImage } = await import('@/lib/gemini')
    const result = await geminiImage({ prompt: 'festive marigold setting', refImageDataUrl: 'data:image/jpeg;base64,PHOTO' })
    expect(result).toEqual({ imageDataUrl: 'data:image/png;base64,IMG', provider: 'gemini' })
    expect(sentUrl(fetchMock)).toContain('/models/gemini-2.5-flash-image:generateContent')
    const [photo, instruction] = sentBody(fetchMock).contents[0].parts
    expect(photo).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'PHOTO' } })
    expect(instruction.text).toMatch(/Keep the product itself exactly as it is/)
    expect(instruction.text).toContain('festive marigold setting')
  })

  it('generates from the prompt alone when there is no usable photo', async () => {
    const fetchMock = stubFetch(imageReply)
    const { geminiImage } = await import('@/lib/gemini')
    await geminiImage({ prompt: 'a clay pot', refImageDataUrl: 'not-a-data-url' })
    expect(sentBody(fetchMock).contents[0].parts).toEqual([{ text: 'a clay pot' }])
  })

  it('throws when no image comes back', async () => {
    stubFetch(geminiReply('sorry, text only'))
    const { geminiImage } = await import('@/lib/gemini')
    await expect(geminiImage({ prompt: 'x' })).rejects.toThrow(/no image/)
  })
})

describe('image chain uses Nano Banana first', () => {
  it('returns the Gemini image without trying the other providers', async () => {
    const fetchMock = stubFetch({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'G' } }] } }] }),
    })
    const { generateImage } = await import('@/lib/imageProviders')
    expect(await generateImage({ prompt: 'pot' })).toEqual({ imageDataUrl: 'data:image/png;base64,G', provider: 'gemini' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/ai uses Gemini first', () => {
  const request = (body: unknown) =>
    new NextRequest('http://localhost/api/ai', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

  it('answers from Gemini and never calls Claude', async () => {
    stubFetch(geminiReply('Charge ₹1,200 — it took 10 hours'))
    const { POST } = await import('@/app/api/ai/route')
    const res = await POST(request({ messages: [{ role: 'user', content: 'Price?' }], mode: 'pricing', language: 'te' }))
    const body = await res.json()
    expect(body).toMatchObject({ provider: 'gemini', text: 'Charge ₹1,200, it took 10 hours' })
    expect(mocks.anthropicCreate).not.toHaveBeenCalled()
  })

  it('requests JSON for design inspiration', async () => {
    const fetchMock = stubFetch(geminiReply('{"designIdea":"x"}'))
    const { POST } = await import('@/app/api/ai/route')
    await POST(request({ messages: [{ role: 'user', content: 'idea' }], mode: 'design_inspiration' }))
    expect(sentBody(fetchMock).generationConfig.responseMimeType).toBe('application/json')
  })

  it('falls back to Claude when Gemini fails', async () => {
    stubFetch(httpError(500))
    mocks.anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: 'from claude' }], usage: { input_tokens: 1, output_tokens: 1 } })
    const { POST } = await import('@/app/api/ai/route')
    const body = await (await POST(request({ messages: [{ role: 'user', content: 'hi' }] }))).json()
    expect(body.text).toBe('from claude')
    expect(body.provider).toBeUndefined()
  })

  it('skips Gemini entirely when no key is set', async () => {
    delete process.env.GEMINI_API_KEY
    const fetchMock = stubFetch()
    mocks.anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: 'claude' }], usage: { input_tokens: 1, output_tokens: 1 } })
    const { POST } = await import('@/app/api/ai/route')
    await POST(request({ messages: [{ role: 'user', content: 'hi' }] }))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('evaluateStory uses Gemini first', () => {
  const scores = {
    storytelling: 8, clarity: 8, authenticity: 9, craftRelevance: 9, culturalContext: 7,
    informationalValue: 8, readability: 8, overall: 8.2, feedback: null,
  }

  it('returns valid Gemini scores without calling Claude', async () => {
    stubFetch(geminiReply(JSON.stringify(scores)))
    const { evaluateStory } = await import('@/lib/storyEvaluator')
    expect(await evaluateStory('Title', 'Content')).toEqual(scores)
    expect(mocks.anthropicCreate).not.toHaveBeenCalled()
  })

  it('falls back to Claude when Gemini returns an invalid score object', async () => {
    stubFetch(geminiReply('{"overall": 42}'))
    mocks.anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(scores) }] })
    const { evaluateStory } = await import('@/lib/storyEvaluator')
    expect(await evaluateStory('Title', 'Content')).toEqual(scores)
    expect(mocks.anthropicCreate).toHaveBeenCalledTimes(1)
  })
})
