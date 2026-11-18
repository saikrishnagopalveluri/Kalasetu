import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('rateLimit utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows the configured number of requests and limits the next one', async () => {
    const { isRateLimited } = await import('@/lib/rateLimit')

    expect(isRateLimited('test-user', 2, 60_000)).toBe(false)
    expect(isRateLimited('test-user', 2, 60_000)).toBe(false)
    expect(isRateLimited('test-user', 2, 60_000)).toBe(true)
    expect(isRateLimited('test-user', 2, 60_000)).toBe(true)
  })

  it('resets a key after its time window expires', async () => {
    const { isRateLimited } = await import('@/lib/rateLimit')

    expect(isRateLimited('test-user', 1, 1_000)).toBe(false)
    expect(isRateLimited('test-user', 1, 1_000)).toBe(true)

    vi.advanceTimersByTime(1_001)
    expect(isRateLimited('test-user', 1, 1_000)).toBe(false)
  })

  it('isolates rate-limit counters by key', async () => {
    const { isRateLimited } = await import('@/lib/rateLimit')

    expect(isRateLimited('user-a', 1, 60_000)).toBe(false)
    expect(isRateLimited('user-a', 1, 60_000)).toBe(true)
    expect(isRateLimited('user-b', 1, 60_000)).toBe(false)
  })

  it('prefers x-real-ip over x-forwarded-for', async () => {
    const { clientKey } = await import('@/lib/rateLimit')

    const request = new Request('http://localhost', {
      headers: {
        'x-real-ip': ' 203.0.113.10 ',
        'x-forwarded-for': '198.51.100.1, 203.0.113.10',
      },
    })
    expect(clientKey(request)).toBe('203.0.113.10')
  })

  it('uses the last forwarded IP when x-real-ip is absent', async () => {
    const { clientKey } = await import('@/lib/rateLimit')

    const request = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.10' },
    })
    expect(clientKey(request)).toBe('203.0.113.10')
  })

  it('returns unknown when no IP headers are present', async () => {
    const { clientKey } = await import('@/lib/rateLimit')

    expect(clientKey(new Request('http://localhost'))).toBe('unknown')
  })

  it('creates distinct user keys', async () => {
    const { userKey } = await import('@/lib/rateLimit')

    expect(userKey('123')).toBe('user:123')
    expect(userKey('456')).not.toBe(userKey('123'))
  })
})
