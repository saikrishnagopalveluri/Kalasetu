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
  return new NextRequest('http://localhost/api/photoshoot', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/photoshoot', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ ok: true, userId: 'user-123' })
    mocks.isRateLimited.mockReturnValue(false)
  })

  it('rejects unauthenticated requests', async () => {
    mocks.requireUser.mockResolvedValue({ ok: false, userId: null })
    const { POST } = await import('@/app/api/photoshoot/route')
    const response = await POST(request({ productName: 'Saree' }))
    expect(response.status).toBe(401)
    expect(mocks.generateImage).not.toHaveBeenCalled()
  })

  it('rate limits image generation before provider calls', async () => {
    mocks.isRateLimited.mockReturnValue(true)
    const { POST } = await import('@/app/api/photoshoot/route')
    const response = await POST(request({ productName: 'Saree' }))
    expect(response.status).toBe(429)
    expect(mocks.generateImage).not.toHaveBeenCalled()
  })

  it.each([
    ['missing product name', {}],
    ['empty product name', { productName: '' }],
    ['non-string product name', { productName: 42 }],
  ])('validates %s', async (_label, body) => {
    const { POST } = await import('@/app/api/photoshoot/route')
    const response = await POST(request(body))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Product name is required' })
    expect(mocks.generateImage).not.toHaveBeenCalled()
  })

  it('builds a prompt from product details and returns generated image data', async () => {
    mocks.generateImage.mockResolvedValue({ imageDataUrl: 'data:image/png;base64,abc', provider: 'cloudflare' })
    const { POST } = await import('@/app/api/photoshoot/route')
    const response = await POST(request({
      productName: 'Handwoven saree',
      material: 'cotton',
      preset: 'heritage',
      colorHint: 'red',
      refineNote: 'show texture',
      refImageDataUrl: 'data:image/png;base64,reference',
    }))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.imageDataUrl).toBe('data:image/png;base64,abc')
    expect(body.prompt).toContain('Handwoven saree')
    expect(body.prompt).toContain('made of cotton')
    expect(body.prompt).toContain('predominantly red in colour')
    expect(body.prompt).toContain('traditional Indian heritage setting')
    expect(body.prompt).toContain('show texture')
    expect(mocks.generateImage).toHaveBeenCalledWith(expect.objectContaining({
      refImageDataUrl: 'data:image/png;base64,reference',
    }))
  })

  it('returns 503 when every image provider fails', async () => {
    mocks.generateImage.mockRejectedValue(new MockAllProvidersFailedError([
      { provider: 'huggingface', error: 'quota' },
    ]))
    const { POST } = await import('@/app/api/photoshoot/route')
    const response = await POST(request({ productName: 'Saree' }))
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      error: 'Photoshoot generation is temporarily unavailable. Please try again shortly.',
    })
  })
})
