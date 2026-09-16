import type { TranslationKey } from './translations'

// Shared between the Profile page (which shows the checklist) and the homepage
// (which feeds it into gamification XP) — keeping one definition avoids the two
// drifting apart.
export type CompletenessInput = {
  photoUrl: string | null
  about: string | null
  businessName: string | null
  achievementsCount: number
  portfolioCount: number
}

export function computeProfileCompleteness(input: CompletenessInput) {
  const checks: { done: boolean; labelKey: TranslationKey }[] = [
    { done: !!input.photoUrl, labelKey: 'profile.check.photo' },
    { done: !!input.about, labelKey: 'profile.check.story' },
    { done: !!input.businessName, labelKey: 'profile.check.businessName' },
    { done: input.achievementsCount > 0, labelKey: 'profile.check.achievement' },
    { done: input.portfolioCount >= 3, labelKey: 'profile.check.portfolio' },
  ]
  const completeness = Math.round((checks.filter((c) => c.done).length / checks.length) * 100)
  return { checks, completeness }
}
