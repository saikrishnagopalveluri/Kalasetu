import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  in: vi.fn(),
  checkAndAwardBadges: vi.fn(),
}))

vi.mock('@/lib/requireUser', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: { from: mocks.from } }))
vi.mock('@/lib/badges', () => ({ checkAndAwardBadges: mocks.checkAndAwardBadges }))

function request() {
  return new NextRequest('http://localhost/api/module-complete-hook', { method: 'POST' })
}

describe('POST /api/module-complete-hook', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.requireUser.mockResolvedValue({ ok: true, userId: 'user-123' })
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.eq.mockReturnValue({ in: mocks.in })
    mocks.in.mockResolvedValue({ data: [] })
  })

  it('rejects unauthenticated requests', async () => {
    mocks.requireUser.mockResolvedValue({ ok: false, userId: null })
    const { POST } = await import('@/app/api/module-complete-hook/route')
    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('returns incomplete when not all Level 1 modules are completed', async () => {
    mocks.in.mockResolvedValue({ data: [{ module_id: 'l1-pricing' }] })
    const { POST } = await import('@/app/api/module-complete-hook/route')
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, level1Complete: false })
    expect(mocks.checkAndAwardBadges).not.toHaveBeenCalled()
  })

  it('awards the Level 1 completion badge only when every module is complete', async () => {
    const ids = ['l1-pricing', 'l1-vishwakarma', 'l1-whatsapp', 'l1-descriptions', 'l1-instagram', 'l1-protecting']
    mocks.in.mockResolvedValue({ data: ids.map((module_id) => ({ module_id })) })
    const { POST } = await import('@/app/api/module-complete-hook/route')
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, level1Complete: true })
    expect(mocks.checkAndAwardBadges).toHaveBeenCalledWith('user-123', 'LEVEL1_COMPLETE')
  })

  it('handles a null progress result safely', async () => {
    mocks.in.mockResolvedValue({ data: null })
    const { POST } = await import('@/app/api/module-complete-hook/route')
    const response = await POST(request())
    expect(await response.json()).toEqual({ ok: true, level1Complete: false })
  })
})
