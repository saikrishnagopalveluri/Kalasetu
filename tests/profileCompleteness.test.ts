import { describe, it, expect } from 'vitest'
import { computeProfileCompleteness, type CompletenessInput } from '@/lib/profileCompleteness'
import { STORY_CATEGORIES } from '@/lib/storyCategories'
import { getTranslations } from '@/lib/translations'

const empty: CompletenessInput = {
  photoUrl: null, about: null, businessName: null, achievementsCount: 0, portfolioCount: 0,
}

const full: CompletenessInput = {
  photoUrl: 'https://example.com/me.jpg',
  about: 'I weave Ikat sarees.',
  businessName: 'Pochampally Looms',
  achievementsCount: 1,
  portfolioCount: 3,
}

describe('computeProfileCompleteness', () => {
  it('scores an empty profile at 0%', () => {
    const { completeness, checks } = computeProfileCompleteness(empty)
    expect(completeness).toBe(0)
    expect(checks.every((c) => !c.done)).toBe(true)
  })

  it('scores a complete profile at 100%', () => {
    expect(computeProfileCompleteness(full).completeness).toBe(100)
  })

  it('counts each finished item as 20%', () => {
    expect(computeProfileCompleteness({ ...empty, photoUrl: 'x' }).completeness).toBe(20)
    expect(computeProfileCompleteness({ ...empty, photoUrl: 'x', about: 'y' }).completeness).toBe(40)
  })

  it('needs at least three portfolio items', () => {
    expect(computeProfileCompleteness({ ...full, portfolioCount: 2 }).completeness).toBe(80)
  })

  it('treats empty strings as not done', () => {
    expect(computeProfileCompleteness({ ...full, about: '', businessName: '' }).completeness).toBe(60)
  })

  it('uses checklist labels that exist in the English dictionary', () => {
    const en = getTranslations('en')
    for (const check of computeProfileCompleteness(empty).checks) {
      expect(en[check.labelKey], check.labelKey).toBeTruthy()
    }
  })
})

describe('STORY_CATEGORIES', () => {
  it('has unique stored values', () => {
    const values = STORY_CATEGORIES.map((c) => c.value)
    expect(new Set(values).size).toBe(values.length)
  })

  it('has a label for every category in the English dictionary', () => {
    const en = getTranslations('en')
    for (const c of STORY_CATEGORIES) expect(en[c.key], c.key).toBeTruthy()
  })
})
