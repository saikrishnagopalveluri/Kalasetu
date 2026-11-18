import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSupabaseMock, type QueryResult } from './helpers/supabaseMock'

const state = vi.hoisted(() => ({ db: null as null | { from: (table: string) => unknown } }))

vi.mock('@/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    return state.db
  },
}))

// Defaults describe a brand-new artisan who has earned nothing yet.
function setup(overrides: Record<string, QueryResult | QueryResult[]> = {}) {
  const mock = createSupabaseMock({
    stories: [{ count: 0 }, { data: null }, { data: [] }],
    saathi_rewards: { count: 0 },
    products: { count: 0 },
    artisan_profiles: { data: { catalogue_published: false } },
    module_progress: { count: 0 },
    ...overrides,
  })
  state.db = mock
  return mock
}

function awarded(mock: ReturnType<typeof setup>) {
  return mock.callsTo('artisan_badges', 'upsert').map(([row]) => (row as { badge_id: string }).badge_id)
}

describe('checkAndAwardBadges', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('does nothing when the service-role client is missing', async () => {
    state.db = null
    const { checkAndAwardBadges } = await import('@/lib/badges')
    await expect(checkAndAwardBadges('user-1', 'STORY_PUBLISHED')).resolves.toBeUndefined()
  })

  it('awards nothing for a first story with no engagement', async () => {
    const mock = setup()
    const { checkAndAwardBadges } = await import('@/lib/badges')
    await checkAndAwardBadges('user-1', 'STORY_PUBLISHED')
    expect(awarded(mock)).toEqual([])
  })

  it('awards Storyteller at five published stories, not four', async () => {
    const four = setup({ stories: [{ count: 4 }, { data: null }, { data: [] }] })
    const { checkAndAwardBadges } = await import('@/lib/badges')
    await checkAndAwardBadges('user-1', 'STORY_PUBLISHED')
    expect(awarded(four)).not.toContain('storyteller')

    const five = setup({ stories: [{ count: 5 }, { data: null }, { data: [] }] })
    await checkAndAwardBadges('user-1', 'STORY_PUBLISHED')
    expect(awarded(five)).toContain('storyteller')
  })

  it('awards Cultural Keeper for a published village or tradition story', async () => {
    const mock = setup({ stories: [{ count: 1 }, { data: { id: 's1' } }, { data: [] }] })
    const { checkAndAwardBadges } = await import('@/lib/badges')
    await checkAndAwardBadges('user-1', 'STORY_PUBLISHED')
    expect(awarded(mock)).toEqual(['cultural_keeper'])
    expect(mock.callsTo('stories', 'in')).toContainEqual([
      'category', ['My Village / Tradition', 'Traditional Craft Knowledge'],
    ])
  })

  it.each([
    ['25 likes', { likes_count: 25, rating_sum: 0, rating_count: 0 }, true],
    ['24 likes', { likes_count: 24, rating_sum: 0, rating_count: 0 }, false],
    ['a 4.5 average over 10 ratings', { likes_count: 0, rating_sum: 45, rating_count: 10 }, true],
    ['a 5.0 average over only 9 ratings', { likes_count: 0, rating_sum: 45, rating_count: 9 }, false],
    ['a 4.4 average over 10 ratings', { likes_count: 0, rating_sum: 44, rating_count: 10 }, false],
  ])('Community Star with %s: %s', async (_label, story, expected) => {
    const mock = setup({ stories: [{ count: 1 }, { data: null }, { data: [story] }] })
    const { checkAndAwardBadges } = await import('@/lib/badges')
    await checkAndAwardBadges('user-1', 'STORY_PUBLISHED')
    expect(awarded(mock).includes('community_star')).toBe(expected)
  })

  it('awards Saathi on a first referral reward and Mentor from the third', async () => {
    const first = setup({ saathi_rewards: { count: 1 } })
    const { checkAndAwardBadges } = await import('@/lib/badges')
    await checkAndAwardBadges('saathi-1', 'REFERRAL_REWARD_UNLOCKED')
    expect(awarded(first)).toEqual(['kalasetu_saathi'])

    const third = setup({ saathi_rewards: { count: 3 } })
    await checkAndAwardBadges('saathi-1', 'REFERRAL_REWARD_UNLOCKED')
    expect(awarded(third)).toEqual(['kalasetu_saathi', 'mentor'])
  })

  it('awards Digital Artisan when Level 1 is complete', async () => {
    const mock = setup()
    const { checkAndAwardBadges } = await import('@/lib/badges')
    await checkAndAwardBadges('user-1', 'LEVEL1_COMPLETE')
    expect(awarded(mock)).toEqual(['digital_artisan'])
  })

  it('awards Master Artisan only when all three conditions hold', async () => {
    const { checkAndAwardBadges } = await import('@/lib/badges')
    const all = {
      products: { count: 10 },
      artisan_profiles: { data: { catalogue_published: true } },
      module_progress: { count: 5 },
    }
    const master = setup(all)
    await checkAndAwardBadges('user-1', 'LEVEL1_COMPLETE')
    expect(awarded(master)).toContain('master_artisan')

    for (const missing of [
      { products: { count: 9 } },
      { artisan_profiles: { data: { catalogue_published: false } } },
      { module_progress: { count: 4 } },
    ]) {
      const mock = setup({ ...all, ...missing })
      await checkAndAwardBadges('user-1', 'LEVEL1_COMPLETE')
      expect(awarded(mock)).not.toContain('master_artisan')
    }
  })

  it('awards idempotently, so repeated events never duplicate a badge', async () => {
    const mock = setup()
    const { checkAndAwardBadges } = await import('@/lib/badges')
    await checkAndAwardBadges('user-1', 'LEVEL1_COMPLETE')
    expect(mock.callsTo('artisan_badges', 'upsert')[0]).toEqual([
      { user_id: 'user-1', badge_id: 'digital_artisan' },
      { onConflict: 'user_id,badge_id', ignoreDuplicates: true },
    ])
  })
})
