import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  isRateLimited: vi.fn(),
  evaluateStory: vi.fn(),
}))

vi.mock('@/lib/requireUser', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/rateLimit', () => ({
  isRateLimited: mocks.isRateLimited,
  userKey: (id: string) => `user:${id}`,
}))
vi.mock('@/lib/storyEvaluator', () => ({ evaluateStory: mocks.evaluateStory }))

function request(body: unknown) {
  return new NextRequest('http://localhost/api/story-evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/story-evaluate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ ok: true, userId: 'user-123' })
    mocks.isRateLimited.mockReturnValue(false)
  })

  it('rejects unauthenticated requests', async () => {
    mocks.requireUser.mockResolvedValue({ ok: false, userId: null })
    const { POST } = await import('@/app/api/story-evaluate/route')
    const response = await POST(request({ title: 'Story', content: 'Content' }))
    expect(response.status).toBe(401)
    expect(mocks.evaluateStory).not.toHaveBeenCalled()
  })

  it('returns 429 for rate-limited users', async () => {
    mocks.isRateLimited.mockReturnValue(true)
    const { POST } = await import('@/app/api/story-evaluate/route')
    const response = await POST(request({ title: 'Story', content: 'Content' }))
    expect(response.status).toBe(429)
    expect(mocks.evaluateStory).not.toHaveBeenCalled()
  })

  it.each([
    ['missing title', { content: 'Story content' }],
    ['missing content', { title: 'Story title' }],
    ['non-string content', { title: 'Story title', content: 123 }],
  ])('validates %s', async (_label, body) => {
    const { POST } = await import('@/app/api/story-evaluate/route')
    const response = await POST(request(body))
    expect(response.status).toBe(400)
    expect(mocks.evaluateStory).not.toHaveBeenCalled()
  })

  it('returns evaluator scores', async () => {
    const scores = { overall: 8.5, feedback: 'Good story', dimensions: {} }
    mocks.evaluateStory.mockResolvedValue(scores)
    const { POST } = await import('@/app/api/story-evaluate/route')
    const response = await POST(request({ title: 'Story title', content: 'Story content', language: 'te' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(scores)
    expect(mocks.evaluateStory).toHaveBeenCalledWith('Story title', 'Story content', 'te')
  })

  it('returns 502 when evaluation returns no scores', async () => {
    mocks.evaluateStory.mockResolvedValue(null)
    const { POST } = await import('@/app/api/story-evaluate/route')
    const response = await POST(request({ title: 'Story title', content: 'Story content' }))
    expect(response.status).toBe(502)
  })

  it('returns a generic 500 when evaluation throws', async () => {
    mocks.evaluateStory.mockRejectedValue(new Error('provider error'))
    const { POST } = await import('@/app/api/story-evaluate/route')
    const response = await POST(request({ title: 'Story title', content: 'Story content' }))
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'AI service unavailable. Please try again.' })
  })
})
