import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fetchWithAuth, type AuthClient } from '@/lib/authFetch'

// A login revoked on the server (for example by logging out on another
// device) still looks valid in this browser until its token runs out. Every
// signed-in API call then failed with 401, and Kala Mitra showed "busy"
// instead of asking the artisan to log in again (seen live on 21 Nov 2026).

function client(tokens: { now: string | null; refreshed: string | null }): AuthClient {
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: tokens.now ? { access_token: tokens.now } : null } })),
      refreshSession: vi.fn(async () => ({
        data: { session: tokens.refreshed ? { access_token: tokens.refreshed } : null },
        error: tokens.refreshed ? null : { message: 'Refresh Token Not Found' },
      })),
    },
  }
}

const ok = () => new Response('{}', { status: 200 })
const unauthorized = () => new Response('{"error":"Not signed in"}', { status: 401 })

describe('fetchWithAuth', () => {
  it('sends the current token and does not refresh when the call succeeds', async () => {
    const c = client({ now: 'tok-1', refreshed: 'tok-2' })
    const f = vi.fn(async () => ok())
    const { res, signedOut } = await fetchWithAuth('/api/x', { method: 'POST', body: '{}' }, c, f)
    expect(res.status).toBe(200)
    expect(signedOut).toBe(false)
    expect(c.auth.refreshSession).not.toHaveBeenCalled()
    const headers = (f.mock.calls[0] as unknown as [string, RequestInit])[1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok-1')
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('refreshes the login once and retries with the new token after a 401', async () => {
    const c = client({ now: 'stale', refreshed: 'fresh' })
    const f = vi.fn().mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok())
    const { res, signedOut } = await fetchWithAuth('/api/x', { method: 'POST' }, c, f)
    expect(res.status).toBe(200)
    expect(signedOut).toBe(false)
    expect(f).toHaveBeenCalledTimes(2)
    const retry = (f.mock.calls[1] as unknown as [string, RequestInit])[1].headers as Record<string, string>
    expect(retry.Authorization).toBe('Bearer fresh')
  })

  it('reports signed out when the login cannot be refreshed', async () => {
    const c = client({ now: 'revoked', refreshed: null })
    const f = vi.fn(async () => unauthorized())
    const { res, signedOut } = await fetchWithAuth('/api/x', { method: 'POST' }, c, f)
    expect(res.status).toBe(401)
    expect(signedOut).toBe(true)
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('reports signed out when the retry is still refused', async () => {
    const c = client({ now: 'stale', refreshed: 'fresh' })
    const f = vi.fn(async () => unauthorized())
    const { signedOut } = await fetchWithAuth('/api/x', { method: 'POST' }, c, f)
    expect(signedOut).toBe(true)
    expect(f).toHaveBeenCalledTimes(2)
  })
})

describe('logging out', () => {
  it('logs out only this device, so other devices stay signed in', () => {
    const provider = readFileSync('lib/AuthProvider.tsx', 'utf8')
    const logOut = provider.slice(provider.indexOf('const logOut'))
    expect(logOut).toMatch(/signOut\(\{\s*scope:\s*'local'\s*\}\)/)
  })
})

describe('Kala Mitra voice page', () => {
  it('asks the artisan to log in again instead of saying busy', () => {
    const page = readFileSync('app/voice/page.tsx', 'utf8')
    expect(page).toContain('fetchWithAuth')
    expect(page).toContain("t('voice.signInAgain')")
  })
})
