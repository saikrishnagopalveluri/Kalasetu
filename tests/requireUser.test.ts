import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}))

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ORIGINAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function request(token?: string) {
  return new NextRequest('http://localhost/api/test', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

describe('requireUser', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_KEY
  })

  it('allows local development when Supabase is not configured', async () => {
    const { requireUser } = await import('@/lib/requireUser')
    await expect(requireUser(request())).resolves.toEqual({ ok: true, userId: null })
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it('rejects a request without a bearer token when Supabase is configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    mocks.createClient.mockReturnValue({ auth: { getUser: mocks.getUser } })
    const { requireUser } = await import('@/lib/requireUser')
    await expect(requireUser(request())).resolves.toEqual({ ok: false, userId: null })
    expect(mocks.getUser).not.toHaveBeenCalled()
  })

  it('returns the authenticated user id for a valid token', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    mocks.createClient.mockReturnValue({ auth: { getUser: mocks.getUser } })
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    const { requireUser } = await import('@/lib/requireUser')
    await expect(requireUser(request('valid-token'))).resolves.toEqual({ ok: true, userId: 'user-123' })
    expect(mocks.getUser).toHaveBeenCalledWith('valid-token')
  })

  it('rejects an invalid token or Supabase auth error', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
    mocks.createClient.mockReturnValue({ auth: { getUser: mocks.getUser } })
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid token') })
    const { requireUser } = await import('@/lib/requireUser')
    await expect(requireUser(request('invalid-token'))).resolves.toEqual({ ok: false, userId: null })
  })
})
