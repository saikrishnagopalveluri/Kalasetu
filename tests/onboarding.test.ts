import { describe, it, expect } from 'vitest'
import { guideSeenKey, hasSeenGuide, markGuideSeen, presentSteps, shouldAutoStartGuide } from '@/lib/onboarding'

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v) },
    data,
  }
}

describe('post-login guide: seen state', () => {
  it('is remembered per account, not per browser', () => {
    const s = memoryStorage()
    markGuideSeen('artisan-a', s)
    expect(hasSeenGuide('artisan-a', s)).toBe(true)
    // A second artisan on the same shared phone still gets the guide.
    expect(hasSeenGuide('artisan-b', s)).toBe(false)
    expect(s.data.get(guideSeenKey('artisan-a'))).toBe('1')
  })

  it('treats unavailable storage as seen so it never nags on every visit', () => {
    expect(hasSeenGuide('x', null)).toBe(true)
    const throwing = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(hasSeenGuide('x', throwing)).toBe(true)
    expect(() => markGuideSeen('x', throwing)).not.toThrow()
  })
})

describe('post-login guide: when to auto-start', () => {
  const base = { userId: 'u1', authLoading: false, languageGateOpen: false, seen: false }

  it('starts for a signed-in artisan who has not seen it', () => {
    expect(shouldAutoStartGuide(base)).toBe(true)
  })

  it.each([
    ['signed out', { userId: null }],
    ['auth still loading', { authLoading: true }],
    ['language chooser open', { languageGateOpen: true }],
    ['already seen', { seen: true }],
  ])('waits when %s', (_label, override) => {
    expect(shouldAutoStartGuide({ ...base, ...override })).toBe(false)
  })
})

describe('post-login guide: steps', () => {
  it('drops steps whose target is not on the page, keeps centred ones', () => {
    const steps = [{ title: 'welcome' }, { element: '#here', title: 'a' }, { element: '#missing', title: 'b' }]
    const out = presentSteps(steps, (sel) => sel === '#here')
    expect(out.map((s) => s.title)).toEqual(['welcome', 'a'])
  })
})
