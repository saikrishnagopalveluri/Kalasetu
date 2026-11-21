import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createSupabaseMock, type QueryResult } from './helpers/supabaseMock'

// The scheduled scraper only skipped a scheme whose title matched exactly.
// The AI named the same Udyam page "Udyam Registration (MSME Registration)"
// on a later run, so the page got a second listing (seen 21 Nov 2026). One
// official page should only ever produce one listing.

const state = vi.hoisted(() => ({ db: null as null | Record<string, unknown>, anthropicCreate: vi.fn() }))

vi.mock('@/lib/supabaseAdmin', () => ({ get supabaseAdmin() { return state.db } }))
vi.mock('@/lib/brand', () => ({ BRAND: { name: 'KalaSetu', fallbackUrl: 'https://example.test' }, BRAND_ID: 'hastkatha' }))
vi.mock('@/lib/gemini', () => ({ isGeminiConfigured: () => false, geminiText: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create: state.anthropicCreate } } }))
vi.mock('groq-sdk', () => ({ default: class {} }))

const SOURCE = { id: 'src-1', url: 'https://udyamregistration.gov.in', label: 'Udyam Registration (MSME)', category: 'scheme', last_content_hash: 'old' }

function setup(opportunities: QueryResult[]) {
  const mock = createSupabaseMock({ scheme_sources: [{ data: [SOURCE] }], opportunities })
  state.db = { from: mock.from }
  return mock
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async (url: string) =>
    url.endsWith('/robots.txt')
      ? { ok: true, text: async () => '' }
      : { ok: true, status: 200, text: async () => '<p>Register your enterprise as MSME for free.</p>' }))
  state.anthropicCreate.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify({ title: 'Udyam Registration (MSME Registration)', description: 'Free MSME registration.', type: 'scheme', deadline: null, relevant: true }) }],
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('runSchemeScrape duplicate guard', () => {
  it('skips a page that already has a listing, even when the AI names it differently', async () => {
    const mock = setup([{ data: null }, { data: { id: 'udyam-1' } }])
    const { runSchemeScrape } = await import('@/app/api/cron/scrape-schemes/route')
    const result = await runSchemeScrape()
    expect(result).toMatchObject({ status: 'done', skippedDuplicate: 1, published: [] })
    expect(mock.callsTo('opportunities', 'insert')).toHaveLength(0)
    expect(mock.callsTo('opportunities', 'eq')).toContainEqual(['official_url', SOURCE.url])
  })

  it('still publishes a page that has no listing yet', async () => {
    const mock = setup([{ data: null }, { data: null }, { data: null }])
    const { runSchemeScrape } = await import('@/app/api/cron/scrape-schemes/route')
    const result = await runSchemeScrape()
    expect(result).toMatchObject({ status: 'done', published: ['Udyam Registration (MSME Registration)'] })
    expect(mock.callsTo('opportunities', 'insert')).toHaveLength(1)
  })
})
