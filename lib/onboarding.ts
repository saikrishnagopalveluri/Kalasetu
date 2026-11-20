// Pure helpers for the post-login guide (components/ProductTour.tsx), kept
// free of React and driver.js so they can be unit-tested directly.

// The old key was per browser, so a second artisan logging in on a shared
// family phone never saw the guide. Keyed by user id now.
const LEGACY_KEY = 'hastkatha-tour-seen'
const KEY_PREFIX = 'ks-guide-seen:'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function safeStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null // private browsing / storage blocked
  }
}

export function guideSeenKey(userId: string) {
  return `${KEY_PREFIX}${userId}`
}

export function hasSeenGuide(userId: string, storage: StorageLike | null = safeStorage()): boolean {
  if (!storage) return true // can't remember a dismissal, so don't nag on every visit
  try {
    return storage.getItem(guideSeenKey(userId)) === '1'
  } catch {
    return true
  }
}

export function markGuideSeen(userId: string, storage: StorageLike | null = safeStorage()) {
  if (!storage) return
  try {
    storage.setItem(guideSeenKey(userId), '1')
    storage.setItem(LEGACY_KEY, '1')
  } catch {
    /* storage full or blocked: worst case the guide shows once more */
  }
}

// The guide may only start once nothing else is covering the dashboard:
// auth has settled, there is a signed-in user, and the first-visit language
// chooser (a full-screen overlay) has been dismissed. Starting earlier put
// the guide's highlights underneath the language chooser.
export function shouldAutoStartGuide(opts: {
  userId: string | null
  authLoading: boolean
  languageGateOpen: boolean
  seen: boolean
}) {
  return Boolean(opts.userId) && !opts.authLoading && !opts.languageGateOpen && !opts.seen
}

export type GuideStepSpec = {
  element?: string
  titleKey: string
  descKey: string
}

// driver.js throws if a step's selector matches nothing, and some dashboard
// sections render only after their data loads, so drop missing targets.
export function presentSteps<T extends { element?: string }>(steps: T[], exists: (selector: string) => boolean): T[] {
  return steps.filter((s) => !s.element || exists(s.element))
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
