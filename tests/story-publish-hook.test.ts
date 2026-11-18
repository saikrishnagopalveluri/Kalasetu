import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  checkAndAwardBadges: vi.fn(),
}))

vi.mock('@/lib/requireUser', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/badges', () => ({ checkAndAwardBadges: mocks.checkAndAwardBadges }))

function request() {
  return new NextRequest('http://localhost/api/story-publish-hook', { method: 'POST' })
}

describe('POST /api/story-publish-hook', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ ok: true, userId: 'user-123' })
  })

  it('rejects unauthenticated requests', async () => {
    mocks.requireUser.mockResolvedValue({ ok: false, userId: null })
    const { POST } = await import('@/app/api/story-publish-hook/route')
    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(mocks.checkAndAwardBadges).not.toHaveBeenCalled()
  })

  it('awards story-published badges to the authenticated user', async () => {
    const { POST } = await import('@/app/api/story-publish-hook/route')
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.checkAndAwardBadges).toHaveBeenCalledWith('user-123', 'STORY_PUBLISHED')
  })

  it('returns a successful response even when the badge helper resolves without a value', async () => {
    mocks.checkAndAwardBadges.mockResolvedValue(undefined)
    const { POST } = await import('@/app/api/story-publish-hook/route')
    const response = await POST(request())
    expect(response.status).toBe(200)
  })
})
