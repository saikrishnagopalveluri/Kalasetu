import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// Both cron routes are unauthenticated by design (Vercel Cron can't send a
// user session) and guarded only by a shared secret header. If that guard
// ever breaks, both routes become public triggers for real AI spend and
// real published content — this is a genuine security boundary, not
// incidental logic, so it gets a dedicated test independent of whether the
// rest of each route's AI/DB calls are mocked.

const ORIGINAL_SECRET = process.env.CRON_SECRET

describe.each([
  ['daily-blog', () => import('@/app/api/cron/daily-blog/route')],
  ['scrape-schemes', () => import('@/app/api/cron/scrape-schemes/route')],
  ['daily (unified)', () => import('@/app/api/cron/daily/route')],
])('%s cron route: auth guard', (_name, importRoute) => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-value'
  })
  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET
  })

  it('rejects a request with no Authorization header', async () => {
    const { GET } = await importRoute()
    const req = new NextRequest('http://localhost/api/cron/test')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('rejects a request with the wrong bearer token', async () => {
    const { GET } = await importRoute()
    const req = new NextRequest('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer wrong-value' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('rejects any request at all if CRON_SECRET is unset (fails closed, not open)', async () => {
    delete process.env.CRON_SECRET
    const { GET } = await importRoute()
    const req = new NextRequest('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer anything' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})
