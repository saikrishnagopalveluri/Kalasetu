import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  isRateLimited: vi.fn(),
  evaluateStory: vi.fn(),
  insert: vi.fn(),
  from: vi.fn(),
  checkAndAwardBadges: vi.fn(),
}))

vi.mock('@/lib/requireUser', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/rateLimit', () => ({
  isRateLimited: mocks.isRateLimited,
  userKey: (id: string) => `user:${id}`,
}))
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: mocks.from },
}))
vi.mock('@/lib/storyEvaluator', () => ({ evaluateStory: mocks.evaluateStory }))
vi.mock('@/lib/badges', () => ({ checkAndAwardBadges: mocks.checkAndAwardBadges }))
vi.mock('@/lib/storyCategories', () => ({
  STORY_CATEGORIES: [{ value: 'craft', label: 'Craft' }],
}))

function request(body: unknown) {
  return new NextRequest('http://localhost/api/story-publish', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/story-publish', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ ok: true, userId: 'user-123' })
    mocks.isRateLimited.mockReturnValue(false)
    mocks.insert.mockResolvedValue({ error: null })
    mocks.from.mockReturnValue({ insert: mocks.insert })
    mocks.checkAndAwardBadges.mockResolvedValue(undefined)
  })

  it('rejects unauthenticated requests', async () => {
    mocks.requireUser.mockResolvedValue({ ok: false, userId: null })
    const { POST } = await import('@/app/api/story-publish/route')
    const response = await POST(request({ title: 'Story', content: 'Content', category: 'craft' }))
    expect(response.status).toBe(401)
    expect(mocks.evaluateStory).not.toHaveBeenCalled()
  })

  it('validates required fields and category', async () => {
    const { POST } = await import('@/app/api/story-publish/route')
    const missing = await POST(request({ title: '', content: 'Content', category: 'craft' }))
    expect(missing.status).toBe(400)
    const invalidCategory = await POST(request({ title: 'Story', content: 'Content', category: 'invalid' }))
    expect(invalidCategory.status).toBe(400)
    expect(mocks.evaluateStory).not.toHaveBeenCalled()
  })

  it('does not publish a story below the server-side threshold', async () => {
    mocks.evaluateStory.mockResolvedValue({ overall: 7.9, feedback: 'Needs improvement' })
    const { POST } = await import('@/app/api/story-publish/route')
    const response = await POST(request({ title: 'Story', content: 'Content', category: 'craft' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, published: false })
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.checkAndAwardBadges).not.toHaveBeenCalled()
  })

  it('publishes only after server-side evaluation reaches the threshold', async () => {
    mocks.evaluateStory.mockResolvedValue({ overall: 8.5, feedback: 'Approved' })
    const { POST } = await import('@/app/api/story-publish/route')
    const response = await POST(request({
      title: 'A handmade story',
      content: 'A story about craft.',
      category: 'craft',
      language: 'te',
      ai_scores: { overall: 10 },
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true, published: true, scores: { overall: 8.5 } })
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      author_id: 'user-123',
      title: 'A handmade story',
      content: 'A story about craft.',
      category: 'craft',
      language: 'te',
      status: 'PUBLISHED',
      ai_scores: { overall: 8.5, feedback: 'Approved' },
    }))
    expect(mocks.checkAndAwardBadges).toHaveBeenCalledWith('user-123', 'STORY_PUBLISHED')
  })

  it('returns 500 when the database insert fails', async () => {
    mocks.evaluateStory.mockResolvedValue({ overall: 9, feedback: 'Approved' })
    mocks.insert.mockResolvedValue({ error: { message: 'database failure' } })
    const { POST } = await import('@/app/api/story-publish/route')
    const response = await POST(request({ title: 'Story', content: 'Content', category: 'craft' }))
    expect(response.status).toBe(500)
    expect(mocks.checkAndAwardBadges).not.toHaveBeenCalled()
  })
})
