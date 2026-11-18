import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  isRateLimited: vi.fn(),
  generateImage: vi.fn(),
}))

class MockAllProvidersFailedError extends Error {
  attempts: { provider: string; error: string }[]
  constructor(attempts: { provider: string; error: string }[]) {
    super('All image providers failed or are unconfigured.')
    this.attempts = attempts
  }
}

vi.mock('@/lib/requireUser', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/rateLimit', () => ({
  isRateLimited: mocks.isRateLimited,
  userKey: (id: string) => `user:${id}`,
}))
vi.mock('@/lib/imageProviders', () => ({
  generateImage: mocks.generateImage,
  AllProvidersFailedError: MockAllProvidersFailedError,
}))

function request(body: unknown) {
  return new NextRequest('http://localhost/api/design-image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/design-image', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ ok: true, userId: 'user-123' })
    mocks.isRateLimited.mockReturnValue(false)
  })

  it('rejects unauthenticated requests', async () => {
    mocks.requireUser.mockResolvedValue({ ok: false, userId: null })
    const { POST } = await import('@/app/api/design-image/route')
    const response = await POST(request({ craftType: 'Pottery' }))
    expect(response.status).toBe(401)
    expect(mocks.generateImage).not.toHaveBeenCalled()
  })

  it('rate limits before generating an image', async () => {
    mocks.isRateLimited.mockReturnValue(true)
    const { POST } = await import('@/app/api/design-image/route')
    const response = await POST(request({ craftType: 'Pottery' }))
    expect(response.status).toBe(429)
    expect(mocks.generateImage).not.toHaveBeenCalled()
  })

  it.each([
    ['missing craft type', {}],
    ['empty craft type', { craftType: '' }],
    ['non-string craft type', { craftType: 123 }],
  ])('validates %s', async (_label, body) => {
    const { POST } = await import('@/app/api/design-image/route')
    const response = await POST(request(body))
    expect(response.status).toBe(400)
    expect(mocks.generateImage).not.toHaveBeenCalled()
  })

  it('uses the selected theme and notes in the prompt', async () => {
    mocks.generateImage.mockResolvedValue({ imageDataUrl: 'data:image/png;base64,abc', provider: 'cloudflare' })
    const { POST } = await import('@/app/api/design-image/route')
    const response = await POST(request({ craftType: 'Warli painting', theme: 'nature', notes: 'use earthy colours' }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.imageDataUrl).toBe('data:image/png;base64,abc')
    expect(body.prompt).toContain('Warli painting')
    expect(body.prompt).toContain('lotus blooms')
    expect(body.prompt).toContain('use earthy colours')
  })

  it('falls back to motifs for an unknown theme', async () => {
    mocks.generateImage.mockResolvedValue({ imageDataUrl: 'data:image/png;base64,abc', provider: 'pollinations' })
    const { POST } = await import('@/app/api/design-image/route')
    const response = await POST(request({ craftType: 'Pottery', theme: 'unknown-theme' }))
    expect(response.status).toBe(200)
    expect((await response.json()).prompt).toContain('paisley (kairi)')
  })

  it('returns 503 when all image providers fail', async () => {
    mocks.generateImage.mockRejectedValue(new MockAllProvidersFailedError([{ provider: 'hf', error: 'quota' }]))
    const { POST } = await import('@/app/api/design-image/route')
    const response = await POST(request({ craftType: 'Pottery' }))
    expect(response.status).toBe(503)
  })
})
