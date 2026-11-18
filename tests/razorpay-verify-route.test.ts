import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHmac } from 'crypto'

const KEY_SECRET = 'test-secret'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  admin: { current: true },
}))

vi.mock('@/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    if (!mocks.admin.current) return null
    return {
      auth: { getUser: mocks.getUser },
      from: () => ({ update: mocks.update }),
    }
  },
}))

function sign(orderId: string, paymentId: string) {
  return createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex')
}

function request(body: unknown, token: string | null = 'token-abc') {
  return new NextRequest('http://localhost/api/razorpay/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function validBody() {
  return { orderId: 'order_1', paymentId: 'pay_1', signature: sign('order_1', 'pay_1') }
}

function mockOrder(order: Record<string, unknown>, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => order })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('POST /api/razorpay/verify', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.admin.current = true
    process.env.RAZORPAY_KEY_ID = 'key-id'
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mocks.eq.mockResolvedValue({ error: null })
    mocks.update.mockReturnValue({ eq: mocks.eq })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('rejects callers without a bearer token', async () => {
    const { POST } = await import('@/app/api/razorpay/verify/route')
    const response = await POST(request(validBody(), null))
    expect(response.status).toBe(401)
  })

  it.each([
    ['malformed JSON', '{not json'],
    ['a JSON null body', 'null'],
    ['missing signature', { orderId: 'order_1', paymentId: 'pay_1' }],
    ['non-string fields', { orderId: 1, paymentId: 2, signature: 3 }],
  ])('returns 400 for %s', async (_label, body) => {
    const { POST } = await import('@/app/api/razorpay/verify/route')
    const response = await POST(request(body))
    expect(response.status).toBe(400)
    expect(mocks.getUser).not.toHaveBeenCalled()
  })

  it('returns 503 when payment keys are not configured', async () => {
    delete process.env.RAZORPAY_KEY_SECRET
    const { POST } = await import('@/app/api/razorpay/verify/route')
    const response = await POST(request(validBody()))
    expect(response.status).toBe(503)
  })

  it('returns 503 when the service-role client is missing', async () => {
    mocks.admin.current = false
    const { POST } = await import('@/app/api/razorpay/verify/route')
    const response = await POST(request(validBody()))
    expect(response.status).toBe(503)
  })

  it('rejects an invalid session token', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('bad token') })
    const { POST } = await import('@/app/api/razorpay/verify/route')
    const response = await POST(request(validBody()))
    expect(response.status).toBe(401)
  })

  it.each([
    ['a forged signature of the right length', 'f'.repeat(64)],
    ['a signature of the wrong length', 'abc'],
    ['a signature for a different payment', sign('order_1', 'pay_other')],
  ])('rejects %s without contacting Razorpay', async (_label, signature) => {
    const fetchMock = mockOrder({})
    const { POST } = await import('@/app/api/razorpay/verify/route')
    const response = await POST(request({ ...validBody(), signature }))
    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('grants the tier recorded on the Razorpay order, not one claimed by the client', async () => {
    const fetchMock = mockOrder({ amount: 29900, status: 'paid', notes: { tier: 'pro', period: 'monthly' } })
    const { POST } = await import('@/app/api/razorpay/verify/route')
    const response = await POST(request({ ...validBody(), tier: 'premium', period: 'annual' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, tier: 'pro', period: 'monthly' })
    expect(fetchMock).toHaveBeenCalledWith('https://api.razorpay.com/v1/orders/order_1', expect.anything())
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      subscription_tier: 'pro',
      subscription_period: 'monthly',
    }))
    expect(mocks.eq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('sets the renewal date a year out for annual plans', async () => {
    mockOrder({ amount: 99000, status: 'paid', notes: { tier: 'starter', period: 'annual' } })
    const { POST } = await import('@/app/api/razorpay/verify/route')
    const response = await POST(request(validBody()))
    expect(response.status).toBe(200)
    const renewsAt = new Date(mocks.update.mock.calls[0][0].subscription_renews_at)
    const days = (renewsAt.getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(360)
    expect(days).toBeLessThan(370)
  })

  it.each([
    ['the amount does not match the tier price', { amount: 100, status: 'paid', notes: { tier: 'pro', period: 'monthly' } }],
    ['the order is not paid', { amount: 29900, status: 'created', notes: { tier: 'pro', period: 'monthly' } }],
    ['the order has no tier notes', { amount: 29900, status: 'paid', notes: {} }],
  ])('refuses to upgrade when %s', async (_label, order) => {
    mockOrder(order)
    const { POST } = await import('@/app/api/razorpay/verify/route')
    const response = await POST(request(validBody()))
    expect(response.status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('returns 502 when Razorpay cannot return the order', async () => {
    mockOrder({}, false)
    const { POST } = await import('@/app/api/razorpay/verify/route')
    const response = await POST(request(validBody()))
    expect(response.status).toBe(502)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('reports a 500 without leaking database details when the update fails', async () => {
    mockOrder({ amount: 29900, status: 'paid', notes: { tier: 'pro', period: 'monthly' } })
    mocks.eq.mockResolvedValue({ error: { message: 'relation "artisan_profiles" violates constraint' } })
    const { POST } = await import('@/app/api/razorpay/verify/route')
    const response = await POST(request(validBody()))
    expect(response.status).toBe(500)
    expect(JSON.stringify(await response.json())).not.toContain('constraint')
  })
})
