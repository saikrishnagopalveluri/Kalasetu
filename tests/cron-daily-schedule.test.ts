import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  runDailyBlog: vi.fn(),
  runSchemeScrape: vi.fn(),
}))

vi.mock('@/app/api/cron/daily-blog/route', () => ({ runDailyBlog: mocks.runDailyBlog }))
vi.mock('@/app/api/cron/scrape-schemes/route', () => ({ runSchemeScrape: mocks.runSchemeScrape }))

const ORIGINAL = { secret: process.env.CRON_SECRET, brand: process.env.NEXT_PUBLIC_BRAND }

const authorized = () =>
  new NextRequest('http://localhost/api/cron/daily', { headers: { authorization: 'Bearer cron-secret' } })

async function runOn(isoDate: string) {
  vi.setSystemTime(new Date(isoDate))
  const { GET } = await import('@/app/api/cron/daily/route')
  return (await GET(authorized())).json()
}

describe('GET /api/cron/daily: schedule and brand guard', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    process.env.CRON_SECRET = 'cron-secret'
    process.env.NEXT_PUBLIC_BRAND = 'hastkatha'
    mocks.runDailyBlog.mockResolvedValue({ published: 'post-slug' })
    mocks.runSchemeScrape.mockResolvedValue({ newCandidates: 2 })
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env.CRON_SECRET = ORIGINAL.secret
    process.env.NEXT_PUBLIC_BRAND = ORIGINAL.brand
  })

  it('scrapes schemes on even days of the year', async () => {
    expect(await runOn('2027-01-02T03:30:00Z')).toEqual({ task: 'schemes', result: { newCandidates: 2 } })
    expect(mocks.runDailyBlog).not.toHaveBeenCalled()
  })

  it('publishes the blog on odd days of the year', async () => {
    expect(await runOn('2027-01-03T03:30:00Z')).toEqual({ task: 'blog', result: { published: 'post-slug' } })
    expect(mocks.runSchemeScrape).not.toHaveBeenCalled()
  })

  it('alternates across a month boundary', async () => {
    // 31 Jan is day 31 (odd), 1 Feb is day 32 (even).
    expect((await runOn('2027-01-31T03:30:00Z')).task).toBe('blog')
    vi.resetModules()
    expect((await runOn('2027-02-01T03:30:00Z')).task).toBe('schemes')
  })

  it('skips the job on the kalasetu deployment so shared data is not written twice', async () => {
    process.env.NEXT_PUBLIC_BRAND = 'kalasetu'
    const body = await runOn('2027-01-02T03:30:00Z')
    expect(body.status).toBe('skipped')
    expect(mocks.runDailyBlog).not.toHaveBeenCalled()
    expect(mocks.runSchemeScrape).not.toHaveBeenCalled()
  })
})
