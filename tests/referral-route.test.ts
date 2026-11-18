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
    mocks.from.mockImplementation(() => {
      const builder = { eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), select: vi.fn(), insert: vi.fn().mockResolvedValue({ error: null }), update: vi.fn().mockReturnThis() }
      builder.select.mockReturnValue(builder)
      return builder
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

  it('registers a referral when the code belongs to another artisan', async () => {
    const builder = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      select: vi.fn(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
    }
    builder.select.mockReturnValue(builder)
    builder.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'saathi-456' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
    mocks.from.mockReturnValue(builder)
    mocks.getUserById.mockResolvedValue({ data: { user: { email: 'new-artisan@example.com' } } })

    const { POST } = await import('@/app/api/referral/route')
    const response = await POST(request({ action: 'register', code: 'SAATHI123' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, registered: true })
    expect(mocks.getUserById).toHaveBeenCalledWith('user-123')
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      saathi_id: expect.any(String),
      referred_user_id: 'user-123',
      referred_email: 'new-artisan@example.com',
      referral_code: 'SAATHI123',
      status: 'REGISTERED',
    }))
  })

  it('silently ignores self-referral codes', async () => {
    const builder = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      select: vi.fn(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
    }
    builder.select.mockReturnValue(builder)
    builder.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: 'user-123' }, error: null })
    mocks.from.mockReturnValue(builder)

    const { POST } = await import('@/app/api/referral/route')
    const response = await POST(request({ action: 'register', code: 'SELF' }))
    expect(await response.json()).toEqual({ ok: true, registered: false })
    expect(builder.insert).not.toHaveBeenCalled()
  })

  it('does not register a user who already has a referral', async () => {
    const builder = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing-referral' }, error: null }),
      select: vi.fn(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
    }
    builder.select.mockReturnValue(builder)
    mocks.from.mockReturnValue(builder)

    const { POST } = await import('@/app/api/referral/route')
    const response = await POST(request({ action: 'register', code: 'SAATHI123' }))
    expect(await response.json()).toEqual({ ok: true, alreadyReferred: true })
    expect(builder.insert).not.toHaveBeenCalled()
  })

  it('does not advance milestones for users without a referral', async () => {
    const builder = {
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnThis(),
    }
    builder.select.mockReturnValue(builder)
    mocks.from.mockReturnValue(builder)

    const { POST } = await import('@/app/api/referral/route')
    const response = await POST(request({ action: 'advance', stage: 'PROFILE_COMPLETED' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, noReferral: true })
  })

  it('rejects invalid referral advancement stages', async () => {
    const { POST } = await import('@/app/api/referral/route')
    const response = await POST(request({ action: 'advance', stage: 'UNSUPPORTED' }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Invalid stage' })
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
