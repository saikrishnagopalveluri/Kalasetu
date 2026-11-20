import type { TranslationKey } from './translations'

// Supabase and the auth provider report errors in English (for example
// "Invalid login credentials"). Login and signup show the matching
// translated message instead, so an artisan using the app in Telugu or
// Hindi is never shown a raw English error.
const RULES: [RegExp, TranslationKey][] = [
  [/invalid login credentials|invalid (email|password)|wrong password/i, 'auth.invalidCredentials'],
  [/email not confirmed|confirm your email/i, 'auth.emailNotConfirmed'],
  [/already (registered|exists)|user already/i, 'auth.alreadyRegistered'],
  [/rate limit|too many|security purposes|try again (later|after)/i, 'auth.tooManyAttempts'],
  [/password should|weak password|password is too/i, 'auth.weakPassword'],
  [/not available right now/i, 'auth.unavailable'],
]

export function authErrorKey(message: string | null | undefined): TranslationKey | null {
  if (!message) return null
  for (const [pattern, key] of RULES) {
    if (pattern.test(message)) return key
  }
  return 'common.somethingWrong'
}
