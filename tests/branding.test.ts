import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

// Two brands (KalaSetu, Hastkatha) now share this codebase and database —
// see lib/brand.ts. The old version of this test asserted the old brand
// name was gone everywhere; that guard is now backwards. What actually
// matters going forward:
//   1. Every other file routes brand text through lib/brand.ts rather than
//      hardcoding either name — a hardcoded literal is exactly how one
//      brand's page would silently show the other brand's name again.
//   2. lib/brand.ts itself resolves correctly for both env values.
//   3. translations.ts's {{BRAND}} substitution actually substitutes.

const ORIGINAL_BRAND_ENV = process.env.NEXT_PUBLIC_BRAND

describe('lib/brand.ts: resolves per NEXT_PUBLIC_BRAND', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => { process.env.NEXT_PUBLIC_BRAND = ORIGINAL_BRAND_ENV })

  it('resolves to kalasetu when NEXT_PUBLIC_BRAND=kalasetu', async () => {
    process.env.NEXT_PUBLIC_BRAND = 'kalasetu'
    const { BRAND, BRAND_ID } = await import('@/lib/brand')
    expect(BRAND_ID).toBe('kalasetu')
    expect(BRAND.name).toBe('KalaSetu')
  })

  it('resolves to hastkatha when NEXT_PUBLIC_BRAND=hastkatha', async () => {
    process.env.NEXT_PUBLIC_BRAND = 'hastkatha'
    const { BRAND, BRAND_ID } = await import('@/lib/brand')
    expect(BRAND_ID).toBe('hastkatha')
    expect(BRAND.name).toBe('Hastkatha')
  })

  it('defaults to hastkatha for an unset or unrecognized value (fails to the primary brand, not silently to neither)', async () => {
    delete process.env.NEXT_PUBLIC_BRAND
    const { BRAND_ID: unset } = await import('@/lib/brand')
    expect(unset).toBe('hastkatha')

    vi.resetModules()
    process.env.NEXT_PUBLIC_BRAND = 'something-unexpected'
    const { BRAND_ID: bogus } = await import('@/lib/brand')
    expect(bogus).toBe('hastkatha')
  })

  it('never points the support email at kalasetu.in — that domain belongs to an unrelated business', async () => {
    for (const id of ['kalasetu', 'hastkatha']) {
      vi.resetModules()
      process.env.NEXT_PUBLIC_BRAND = id
      const { BRAND } = await import('@/lib/brand')
      expect(BRAND.supportEmail).not.toMatch(/@kalasetu\.in$/)
    }
  })
})

describe('translations.ts: {{BRAND}} substitution', () => {
  it('substitutes {{BRAND}} with the resolved brand name in returned strings', async () => {
    const { getTranslations } = await import('@/lib/translations')
    const en = getTranslations('en')
    for (const value of Object.values(en)) {
      expect(value).not.toContain('{{BRAND}}')
    }
  })
})

describe('branding: no hardcoded brand name outside lib/brand.ts', () => {
  const SCAN_ROOTS = ['app', 'components', 'lib']
  const EXEMPT_FILES = new Set(['lib/brand.ts'])
  const repoRoot = path.resolve(__dirname, '..')

  function walk(dir: string): string[] {
    const out: string[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...walk(full))
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
    }
    return out
  }

  const files = SCAN_ROOTS.flatMap((root) => walk(path.join(repoRoot, root)))
    .filter((f) => !EXEMPT_FILES.has(path.relative(repoRoot, f).replace(/\\/g, '/')))

  it('scanned at least the expected number of source files', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('contains no hardcoded "KalaSetu" or "Hastkatha" literal — brand text must come from lib/brand.ts', () => {
    const offenders: string[] = []
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8')
      // Comments are excluded — a code comment mentioning the brand by name
      // for context (like this file's own header) isn't a rendering bug.
      const codeOnly = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      if (/KalaSetu|Hastkatha/.test(codeOnly)) {
        offenders.push(path.relative(repoRoot, file))
      }
    }
    expect(offenders, `hardcoded brand name found in:\n${offenders.join('\n')}`).toHaveLength(0)
  })

  it('still allows the one known-safe literal: kalasetu-six.vercel.app, the working fallback URL', () => {
    const brandTs = fs.readFileSync(path.join(repoRoot, 'lib', 'brand.ts'), 'utf8')
    expect(brandTs).toContain('kalasetu-six.vercel.app')
  })
})
