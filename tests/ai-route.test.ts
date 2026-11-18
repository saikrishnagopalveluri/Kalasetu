import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  anthropicCreate: vi.fn(),
  groqCreate: vi.fn(),
  requireUser: vi.fn(),
  isRateLimited: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mocks.anthropicCreate }
    constructor() {}
  },
}))

vi.mock('groq-sdk', () => ({
  default: class MockGroq {
    chat = { completions: { create: mocks.groqCreate } }
    constructor() {}
  },
}))

vi.mock('@/lib/requireUser', () => ({
  requireUser: mocks.requireUser,
}))

vi.mock('@/lib/rateLimit', () => ({
  isRateLimited: mocks.isRateLimited,
  userKey: (id: string) => `user:${id}`,
}))

function request(body: unknown) {
  return new NextRequest('http://localhost/api/ai', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const claudeResponse = (text: string) => ({
  content: [{ type: 'text', text }],
  usage: { input_tokens: 12, output_tokens: 8 },
})

describe('POST /api/ai', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
    process.env.GROQ_API_KEY = 'test-groq-key'
    mocks.requireUser.mockResolvedValue({ ok: true, userId: 'user-123' })
    mocks.isRateLimited.mockReturnValue(false)
  })

  it('rejects unauthenticated requests before calling an AI provider', async () => {
    mocks.requireUser.mockResolvedValue({ ok: false, userId: null })
    const { POST } = await import('@/app/api/ai/route')

    const response = await POST(request({ messages: [{ role: 'user', content: 'Hello' }] }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Not signed in' })
    expect(mocks.anthropicCreate).not.toHaveBeenCalled()
    expect(mocks.groqCreate).not.toHaveBeenCalled()
  })

  it('returns 429 when the authenticated user is rate limited', async () => {
    mocks.isRateLimited.mockReturnValue(true)
    const { POST } = await import('@/app/api/ai/route')

    const response = await POST(request({ messages: [{ role: 'user', content: 'Hello' }] }))
    expect(response.status).toBe(429)
    expect(mocks.anthropicCreate).not.toHaveBeenCalled()
    expect(mocks.groqCreate).not.toHaveBeenCalled()
  })

  it.each([
    ['missing messages', {}],
    ['empty messages', { messages: [] }],
    ['non-array messages', { messages: 'hello' }],
  ])('returns 400 for %s', async (_label, body) => {
    const { POST } = await import('@/app/api/ai/route')

    const response = await POST(request(body))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Messages array is required' })
    expect(mocks.anthropicCreate).not.toHaveBeenCalled()
    expect(mocks.groqCreate).not.toHaveBeenCalled()
  })

  it('returns Claude text, usage, and sanitizes em dashes', async () => {
    mocks.anthropicCreate.mockResolvedValue(claudeResponse('Handmade art — made with care.'))
    const { POST } = await import('@/app/api/ai/route')

    const response = await POST(request({
      messages: [{ role: 'user', content: 'Write a product description' }],
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      text: 'Handmade art, made with care.',
      usage: { input_tokens: 12, output_tokens: 8 },
    })
    expect(mocks.anthropicCreate).toHaveBeenCalledTimes(1)
    expect(mocks.groqCreate).not.toHaveBeenCalled()
  })

  it('falls back to Groq when Claude fails', async () => {
    mocks.anthropicCreate.mockRejectedValue(new Error('Claude unavailable'))
    mocks.groqCreate.mockResolvedValue({
      choices: [{ message: { content: 'A beautiful handmade product.' } }],
      usage: { prompt_tokens: 20, completion_tokens: 10 },
    })
    const { POST } = await import('@/app/api/ai/route')

    const response = await POST(request({
      messages: [{ role: 'user', content: 'Describe this craft' }],
      mode: 'description',
    }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      text: 'A beautiful handmade product.',
      usage: { input_tokens: 20, output_tokens: 10 },
      provider: 'groq',
    })
    expect(mocks.groqCreate).toHaveBeenCalledTimes(1)
    expect(mocks.groqCreate.mock.calls[0][0].messages[0].content).toContain('product description')
  })

  it('returns a generic 500 when both providers fail', async () => {
    mocks.anthropicCreate.mockRejectedValue(new Error('Claude unavailable'))
    mocks.groqCreate.mockRejectedValue(new Error('Groq unavailable'))
    const { POST } = await import('@/app/api/ai/route')

    const response = await POST(request({
      messages: [{ role: 'user', content: 'Hello' }],
    }))

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: 'AI service unavailable. Please try again.',
    })
  })

  it('returns a generic 500 when Claude returns no text content', async () => {
    mocks.anthropicCreate.mockResolvedValue({
      content: [{ type: 'image', source: {} }],
      usage: { input_tokens: 1, output_tokens: 1 },
    })
    mocks.groqCreate.mockResolvedValue({
      choices: [{ message: { content: 'Fallback response' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    })
    const { POST } = await import('@/app/api/ai/route')

    const response = await POST(request({
      messages: [{ role: 'user', content: 'Hello' }],
    }))

    // Missing Claude text is treated as a provider failure and uses fallback.
    expect(response.status).toBe(200)
    expect((await response.json()).provider).toBe('groq')
    expect(mocks.groqCreate).toHaveBeenCalledTimes(1)
  })
})
