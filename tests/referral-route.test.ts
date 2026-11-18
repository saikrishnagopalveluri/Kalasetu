import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  from: vi.fn(),
  checkAndAwardBadges: vi.fn(),
  getUserById: vi.fn(),
}))

vi.mock('@/lib/requireUser', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: mocks.from,
    auth: { admin: { getUserById: mocks.getUserById } },
  },
}))
vi.mock('@/lib/badges', () => ({ checkAndAwardBadges: mocks.checkAndAwardBadges }))
vi.mock('@/lib/brand', () => ({ BRAND: { name: 'KalaSetu' } }))

function request(body: unknown) {
  return new NextRequest('http://localhost/api/referral', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/referral', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ ok: true, userId: 'user-123' })
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    })
  })

  it('rejects unauthenticated requests', async () => {
    mocks.requireUser.mockResolvedValue({ ok: false, userId: null })
    const { POST } = await import('@/app/api/referral/route')
    const response = await POST(request({ action: 'register', code: 'ABC' }))
    expect(response.status).toBe(401)
  })

  it('rejects unknown actions', async () => {
    const { POST } = await import('@/app/api/referral/route')
    const response = await POST(request({ action: 'unknown' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Unknown action' })
  })

  it('requires a referral code for registration', async () => {
    const { POST } = await import('@/app/api/referral/route')
    const response = await POST(request({ action: 'register', code: '' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Missing code' })
  })

  it('rejects invalid referral advancement stages', async () => {
    const { POST } = await import('@/app/api/referral/route')
    const response = await POST(request({ action: 'advance', stage: 'UNSUPPORTED' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid stage' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
