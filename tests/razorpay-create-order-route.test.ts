import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  admin: { current: true },
}))

vi.mock('@/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    return mocks.admin.current ? { auth: { getUser: mocks.getUser } } : null
  },
}))

function request(body: unknown, token: string | null = 'token-abc') {
  return new NextRequest('http://localhost/api/razorpay/create-order', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

describe('POST /api/razorpay/create-order', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.admin.current = true
    process.env.RAZORPAY_KEY_ID = 'key-id'
    process.env.RAZORPAY_KEY_SECRET = 'key-secret'
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it.each([
    ['an unknown tier', { tier: 'gold', period: 'monthly' }],
    ['an unknown period', { tier: 'pro', period: 'weekly' }],
    ['malformed JSON', '{oops'],
  ])('returns 400 for %s', async (_label, body) => {
    const { POST } = await import('@/app/api/razorpay/create-order/route')
    const response = await POST(request(body))
    expect(response.status).toBe(400)
  })

  it('returns 503 when Razorpay keys are missing', async () => {
    delete process.env.RAZORPAY_KEY_ID
    const { POST } = await import('@/app/api/razorpay/create-order/route')
    const response = await POST(request({ tier: 'pro', period: 'monthly' }))
    expect(response.status).toBe(503)
  })

  it('requires a signed-in user before creating an order', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { POST } = await import('@/app/api/razorpay/create-order/route')
    const response = await POST(request({ tier: 'pro', period: 'monthly' }, null))
    expect(response.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid session token', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('expired') })
    const { POST } = await import('@/app/api/razorpay/create-order/route')
    const response = await POST(request({ tier: 'pro', period: 'monthly' }))
    expect(response.status).toBe(401)
  })

  it('charges the server-side price and records the tier on the order', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'order_9' }) })
    vi.stubGlobal('fetch', fetchMock)
    const { POST } = await import('@/app/api/razorpay/create-order/route')
    const response = await POST(request({ tier: 'premium', period: 'annual', amount: 1 }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ orderId: 'order_9', amount: 599000, keyId: 'key-id' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.razorpay.com/v1/orders')
    expect(JSON.parse(init.body)).toEqual({
      amount: 599000,
      currency: 'INR',
      notes: { tier: 'premium', period: 'annual' },
    })
  })

  it('returns a generic 502 when Razorpay rejects the order', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'bad key secret' }))
    const { POST } = await import('@/app/api/razorpay/create-order/route')
    const response = await POST(request({ tier: 'pro', period: 'monthly' }))
    expect(response.status).toBe(502)
    expect(JSON.stringify(await response.json())).not.toContain('secret')
  })
})
