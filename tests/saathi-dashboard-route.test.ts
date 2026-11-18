import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createSupabaseMock, type QueryResult } from './helpers/supabaseMock'

const state = vi.hoisted(() => ({
  db: null as null | { from: (table: string) => unknown },
  requireUser: vi.fn(),
}))

vi.mock('@/lib/requireUser', () => ({ requireUser: state.requireUser }))
vi.mock('@/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    return state.db
  },
}))

function setup(results: Record<string, QueryResult | QueryResult[]>) {
  const mock = createSupabaseMock(results)
  state.db = mock
  return mock
}

const request = () => new NextRequest('http://localhost/api/saathi-dashboard')

describe('GET /api/saathi-dashboard', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    state.requireUser.mockResolvedValue({ ok: true, userId: 'saathi-1' })
  })

  it('returns 503 when the service-role client is missing', async () => {
    state.db = null
    const { GET } = await import('@/app/api/saathi-dashboard/route')
    expect((await GET(request())).status).toBe(503)
  })

  it('rejects unauthenticated callers', async () => {
    setup({})
    state.requireUser.mockResolvedValue({ ok: false, userId: null })
    const { GET } = await import('@/app/api/saathi-dashboard/route')
    expect((await GET(request())).status).toBe(401)
  })

  it('creates a referral code from the artisan name when none exists', async () => {
    const mock = setup({ artisan_profiles: [{ data: { referral_code: null, name: 'Lakshmi Devi' } }, { error: null }] })
    const { GET } = await import('@/app/api/saathi-dashboard/route')
    const body = await (await GET(request())).json()
    expect(body.referralCode).toMatch(/^lakshmid[a-z0-9]{1,4}$/)
    expect(mock.callsTo('artisan_profiles', 'update')[0]).toEqual([{ referral_code: body.referralCode }])
  })

  it('retries with a new code when the first one collides', async () => {
    const mock = setup({
      artisan_profiles: [
        { data: { referral_code: null, name: 'Ravi' } },
        { error: { message: 'duplicate key' } },
        { error: null },
      ],
    })
    const { GET } = await import('@/app/api/saathi-dashboard/route')
    const body = await (await GET(request())).json()
    const attempted = mock.callsTo('artisan_profiles', 'update')
    expect(attempted).toHaveLength(2)
    expect(body.referralCode).toBe((attempted[1][0] as { referral_code: string }).referral_code)
  })

  it('keeps an existing referral code', async () => {
    const mock = setup({ artisan_profiles: { data: { referral_code: 'ravi1234', name: 'Ravi' } } })
    const { GET } = await import('@/app/api/saathi-dashboard/route')
    const body = await (await GET(request())).json()
    expect(body.referralCode).toBe('ravi1234')
    expect(mock.callsTo('artisan_profiles', 'update')).toHaveLength(0)
  })

  it('aggregates impact across referred artisans without exposing private content', async () => {
    setup({
      artisan_profiles: [
        { data: { referral_code: 'ravi1234', name: 'Ravi' } },
        {
          data: [
            { id: 'a1', name: 'Meena', catalogue_published: true },
            { id: 'a2', name: 'Arjun', catalogue_published: false },
          ],
        },
      ],
      saathi_referrals: {
        data: [
          { id: 'r1', status: 'REWARD_UNLOCKED', referred_user_id: 'a1' },
          { id: 'r2', status: 'PROFILE_COMPLETED', referred_user_id: 'a2' },
          { id: 'r3', status: 'INVITED', referred_user_id: null },
        ],
      },
      products: { data: [{ user_id: 'a1' }, { user_id: 'a1' }, { user_id: 'a2' }] },
      saathi_rewards: { data: [{ amount_paise: 10000, status: 'PENDING' }, { amount_paise: 10050, status: 'PAID' }] },
    })
    const { GET } = await import('@/app/api/saathi-dashboard/route')
    const body = await (await GET(request())).json()

    expect(body.stats).toEqual({
      empoweredCount: 1,
      activeCount: 2,
      totalProducts: 3,
      cataloguesCreated: 1,
      rewardsEarnedRupees: 201,
    })
    expect(body.community).toEqual([
      { name: 'Meena', status: 'REWARD_UNLOCKED', productsCount: 2, cataloguePublished: true },
      { name: 'Arjun', status: 'PROFILE_COMPLETED', productsCount: 1, cataloguePublished: false },
      { name: 'Artisan', status: 'INVITED', productsCount: 0, cataloguePublished: false },
    ])
    // Only names, statuses and counts leave the server.
    for (const row of body.community) {
      expect(Object.keys(row).sort()).toEqual(['cataloguePublished', 'name', 'productsCount', 'status'])
    }
  })

  it('returns zeroed stats for a Saathi with no referrals yet', async () => {
    const mock = setup({ artisan_profiles: { data: { referral_code: 'new12345', name: 'New' } } })
    const { GET } = await import('@/app/api/saathi-dashboard/route')
    const body = await (await GET(request())).json()
    expect(body.stats).toEqual({
      empoweredCount: 0, activeCount: 0, totalProducts: 0, cataloguesCreated: 0, rewardsEarnedRupees: 0,
    })
    expect(body.community).toEqual([])
    // No referred ids, so the per-artisan lookups are skipped entirely.
    expect(mock.queries.filter((q) => q.table === 'products')).toHaveLength(0)
  })
})
