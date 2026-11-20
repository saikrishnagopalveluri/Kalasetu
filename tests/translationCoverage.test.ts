import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { getTranslations, TRANSLATED_LANGUAGES, type TranslationKey } from '@/lib/translations'
import { authErrorKey } from '@/lib/authErrors'

// Stricter than the 50% floor in translations.test.ts: every language must
// now have every key, so no screen silently falls back to English.
const raw = fs.readFileSync(path.resolve(__dirname, '../lib/translations.ts'), 'utf8').replace(/\r\n/g, '\n')
const englishKeys = Object.keys(getTranslations('en')) as TranslationKey[]

function ownKeys(lang: string): Map<string, string> {
  const block = raw.match(new RegExp(`\\n  ${lang}: \\{([\\s\\S]*?)\\n  \\},\\n`))?.[1] ?? ''
  return new Map([...block.matchAll(/^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/gm)].map((m) => [m[1], m[2]]))
}

describe('translations: full coverage', () => {
  for (const lang of TRANSLATED_LANGUAGES) {
    if (lang === 'en') continue
    it(`${lang} has its own translation for every English key`, () => {
      const own = ownKeys(lang)
      const missing = englishKeys.filter((k) => !own.has(k))
      expect(missing, `${lang} missing: ${missing.join(', ')}`).toEqual([])
    })
  }

  it('the Kala Mitra voice screen and login errors exist in every language', () => {
    for (const lang of TRANSLATED_LANGUAGES) {
      const dict = getTranslations(lang)
      for (const key of ['voice.title', 'voice.example1', 'voice.screen.photoshoot', 'auth.invalidCredentials', 'common.tooManyRequests'] as TranslationKey[]) {
        expect(dict[key], `${lang}.${key}`).toBeTruthy()
      }
    }
  })

  it.each(['ur', 'ks', 'sd'])('%s is written in its own script, not Roman letters', (lang) => {
    const values = [...ownKeys(lang).values()].join(' ')
    const latinLetters = (values.match(/[A-Za-z]/g) ?? []).length
    const allLetters = (values.match(/\p{L}/gu) ?? []).length
    expect(latinLetters / allLetters).toBeLessThan(0.15)
  })

  it('non-English screens name the voice assistant "Kala Mitra" in their own script', () => {
    expect(getTranslations('te')['voice.bannerTitle']).toContain('కళా మిత్ర')
    expect(getTranslations('hi')['voice.bannerTitle']).toContain('कला मित्र')
    expect(getTranslations('ur')['voice.title']).toContain('کلا مترا')
  })

  it('keeps "Saathi" for the referral program only, never for the voice assistant', () => {
    const voiceKeys = ['voice.title', 'voice.subtitle', 'voice.thinking', 'voice.speaking', 'voice.saathi', 'voice.micDenied', 'voice.busy', 'voice.bannerTitle', 'voice.bannerDesc'] as TranslationKey[]
    for (const lang of TRANSLATED_LANGUAGES) {
      const dict = getTranslations(lang)
      for (const key of voiceKeys) expect(dict[key], `${lang}.${key}`).not.toMatch(/Saathi|साथी|సాథీ|সাথী|ساتھی|ساٿي|சாத்தி|સાથી|ಸಾಥಿ|ସାଥୀ|ਸਾਥੀ|സാഥി|ᱥᱟᱛᱷᱤ/)
    }
    expect(getTranslations('en')['saathi.title']).toContain('Saathi')
  })

  it('explains the price breakdown with every number in every language', () => {
    for (const lang of TRANSLATED_LANGUAGES) {
      const s = getTranslations(lang)['voice.priceExplain']
      for (const n of ['materials', 'hours', 'wage', 'labour', 'cost', 'margin', 'fair', 'minimum', 'online']) {
        expect(s, `${lang} ${n}`).toContain(`{{${n}}}`)
      }
    }
  })
})

describe('authErrorKey', () => {
  it.each([
    ['Invalid login credentials', 'auth.invalidCredentials'],
    ['Email not confirmed', 'auth.emailNotConfirmed'],
    ['User already registered', 'auth.alreadyRegistered'],
    ['For security purposes, you can only request this after 42 seconds.', 'auth.tooManyAttempts'],
    ['Password should be at least 8 characters.', 'auth.weakPassword'],
    ['Login is not available right now.', 'auth.unavailable'],
    ['Database error saving new user', 'common.somethingWrong'],
  ])('maps "%s" to %s', (message, key) => {
    expect(authErrorKey(message)).toBe(key)
  })

  it('returns null when there is no error', () => {
    expect(authErrorKey(null)).toBeNull()
    expect(authErrorKey('')).toBeNull()
  })
})
