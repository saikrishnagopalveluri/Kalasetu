import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { LANGUAGES } from '@/lib/languages'
import { getTranslations, TRANSLATED_LANGUAGES, type TranslationKey } from '@/lib/translations'

// getTranslations() merges every language over English defaults, so a
// missing key never crashes the UI or shows a raw key string — it just
// silently falls back to English. These tests exist to catch the failure
// modes that graceful fallback hides: a language block that's nearly empty,
// an accidentally-empty translated string, or a duplicate object key that
// silently overwrote another value when the file was authored/edited.

const englishKeys = Object.keys(getTranslations('en')) as TranslationKey[]
// Normalized to \n so the block regexes below also work on a Windows
// checkout, where Git may convert the file to CRLF line endings.
const rawSource = fs.readFileSync(path.resolve(__dirname, '../lib/translations.ts'), 'utf8').replace(/\r\n/g, '\n')

describe('translations: structural integrity', () => {
  it('every language listed in lib/languages.ts has a dictionary in translations.ts', () => {
    for (const lang of LANGUAGES) {
      expect(TRANSLATED_LANGUAGES, `missing language block: ${lang.id} (${lang.name})`).toContain(lang.id)
    }
  })

  it('English (the fallback source of truth) has no empty-string values', () => {
    const en = getTranslations('en')
    const empty = englishKeys.filter((k) => en[k] === '')
    expect(empty, `empty English values for: ${empty.join(', ')}`).toHaveLength(0)
  })

  it('no language dictionary has an empty-string value where a translation exists', () => {
    // An empty string is worse than falling back to English — it renders as
    // genuinely blank UI, not just untranslated text.
    const offenders: string[] = []
    for (const lang of TRANSLATED_LANGUAGES) {
      const dict = getTranslations(lang)
      for (const key of englishKeys) {
        if (dict[key] === '') offenders.push(`${lang}.${key}`)
      }
    }
    expect(offenders, `empty values found: ${offenders.slice(0, 20).join(', ')}`).toHaveLength(0)
  })
})

describe('translations: coverage per language', () => {
  // Informational + a floor, not a demand for 100% — the file's own header
  // documents that new keys land in English first and get backfilled.
  // A language dropping below this floor is a real regression worth
  // catching, not just "hasn't been translated yet".
  const MIN_COVERAGE = 0.5

  for (const lang of LANGUAGES) {
    if (lang.id === 'en') continue
    it(`${lang.id} (${lang.name}) covers at least ${MIN_COVERAGE * 100}% of English keys`, () => {
      // Read the raw dictionary (not the English-merged view) to measure
      // actual translated coverage, not post-fallback appearance.
      const blockRe = new RegExp(`\\n  ${lang.id}: \\{([\\s\\S]*?)\\n  \\},\\n`)
      const match = rawSource.match(blockRe)
      expect(match, `could not locate a distinct block for ${lang.id}`).toBeTruthy()
      const ownKeyCount = (match![1].match(/^\s*"[^"]+":/gm) ?? []).length
      const coverage = ownKeyCount / englishKeys.length
      expect(coverage, `${lang.id} covers ${(coverage * 100).toFixed(1)}% (${ownKeyCount}/${englishKeys.length} keys)`).toBeGreaterThanOrEqual(MIN_COVERAGE)
    })
  }
})

describe('translations: duplicate-key detection', () => {
  it('no language block has the same key written twice (silently overwrites the first value)', () => {
    const offenders: string[] = []
    for (const lang of TRANSLATED_LANGUAGES) {
      const blockRe = new RegExp(`\\n  ${lang}: \\{([\\s\\S]*?)\\n  \\},\\n`)
      const match = rawSource.match(blockRe)
      if (!match) continue
      const keys = [...match[1].matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1])
      const seen = new Set<string>()
      for (const k of keys) {
        if (seen.has(k)) offenders.push(`${lang}.${k}`)
        seen.add(k)
      }
    }
    expect(offenders, `duplicate keys found: ${offenders.join(', ')}`).toHaveLength(0)
  })
})
