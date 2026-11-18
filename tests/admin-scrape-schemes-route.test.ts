import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createHash } from 'crypto'
import { createSupabaseMock, type QueryResult } from './helpers/supabaseMock'

const state = vi.hoisted(() => ({
  db: null as null | Record<string, unknown>,
  getUser: vi.fn(),
  anthropicCreate: vi.fn(),
}))

vi.mock('@/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    return state.db
  },
}))
vi.mock('@/lib/brand', () => ({ BRAND: { name: 'KalaSetu', fallbackUrl: 'https://example.test' } }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: state.anthropicCreate }
  },
}))
vi.mock('groq-sdk', () => ({ default: class {} }))

const SOURCE = { id: 'src-1', url: 'https://gov.example/schemes/handloom', label: 'Handloom', category: 'scheme', last_content_hash: null }
const PAGE_HTML = '<html><script>x()</script><body><h1>Handloom Weaver Scheme</h1><p>Grants&nbsp;for weavers.</p></body></html>'
const PAGE_TEXT_HASH = createHash('sha256').update('Handloom Weaver Scheme Grants for weavers.').digest('hex')

function setup(results: Record<string, QueryResult | QueryResult[]> = {}) {
  const mock = createSupabaseMock({
    artisan_profiles: { data: { is_admin: true } },
    scheme_sources: { data: [SOURCE] },
    ...results,
  })
  state.db = { from: mock.from, auth: { getUser: state.getUser } }
  return mock
}

function stubWeb({ robots = '', robotsOk = true, pageOk = true }: { robots?: string; robotsOk?: boolean; pageOk?: boolean } = {}) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith('/robots.txt')) return { ok: robotsOk, text: async (): Promise<string> => robots }
    return { ok: pageOk, status: pageOk ? 200 : 503, text: async (): Promise<string> => PAGE_HTML }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function extraction(fields: Record<string, unknown>) {
  state.anthropicCreate.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify({ title: 'Weaver grant', description: 'Money for looms.', type: 'scheme', deadline: null, relevant: true, ...fields }) }],
  })
}

const request = (token: string | null = 'admin-token') =>
  new NextRequest('http://localhost/api/admin/scrape-schemes', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

describe('POST /api/admin/scrape-schemes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    delete process.env.GROQ_API_KEY
    state.getUser.mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns 503 when the service-role client is missing', async () => {
    state.db = null
    const { POST } = await import('@/app/api/admin/scrape-schemes/route')
    expect((await POST(request())).status).toBe(503)
  })

  it('requires a signed-in user', async () => {
    setup()
    const { POST } = await import('@/app/api/admin/scrape-schemes/route')
    expect((await POST(request(null))).status).toBe(401)
  })

  it('rejects an invalid session', async () => {
    setup()
    state.getUser.mockResolvedValue({ data: { user: null }, error: new Error('expired') })
    const { POST } = await import('@/app/api/admin/scrape-schemes/route')
    expect((await POST(request())).status).toBe(401)
  })

  it('forbids non-admin users before fetching any page', async () => {
    setup({ artisan_profiles: { data: { is_admin: false } } })
    const fetchMock = stubWeb()
    const { POST } = await import('@/app/api/admin/scrape-schemes/route')
    expect((await POST(request())).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('skips a source whose robots.txt disallows the path', async () => {
    const mock = setup()
    const fetchMock = stubWeb({ robots: 'User-agent: *\nDisallow: /schemes' })
    const { POST } = await import('@/app/api/admin/scrape-schemes/route')
    const summary = await (await POST(request())).json()
    expect(summary).toMatchObject({ checked: 1, skippedRobots: 1, newCandidates: 0 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(mock.callsTo('scheme_sources', 'update')[0][0]).toMatchObject({ robots_allowed: false })
  })

  it('ignores Disallow rules aimed at other crawlers', async () => {
    setup()
    stubWeb({ robots: 'User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow: /private' })
    extraction({})
    const { POST } = await import('@/app/api/admin/scrape-schemes/route')
    const summary = await (await POST(request())).json()
    expect(summary).toMatchObject({ skippedRobots: 0, newCandidates: 1 })
  })

  it('stores a relevant result as a pending candidate, never as published', async () => {
    const mock = setup()
    stubWeb()
    extraction({ type: 'competition', deadline: '2027-01-31' })
    const { POST } = await import('@/app/api/admin/scrape-schemes/route')
    const summary = await (await POST(request())).json()
    expect(summary).toMatchObject({ checked: 1, newCandidates: 1, errors: [] })
    const [candidate] = mock.callsTo('scheme_candidates', 'insert')[0] as [Record<string, unknown>]
    expect(candidate).toMatchObject({
      source_id: 'src-1', status: 'pending', type: 'competition', deadline: '2027-01-31', content_hash: PAGE_TEXT_HASH,
    })
    expect(mock.queries.some((q) => q.table === 'opportunities')).toBe(false)
  })

  it('falls back to the source category when the AI returns an unknown type', async () => {
    const mock = setup()
    stubWeb()
    extraction({ type: 'lottery' })
    const { POST } = await import('@/app/api/admin/scrape-schemes/route')
    await POST(request())
    const [candidate] = mock.callsTo('scheme_candidates', 'insert')[0] as [Record<string, unknown>]
    expect(candidate.type).toBe('scheme')
  })

  it('skips unchanged pages without calling the AI', async () => {
    setup({ scheme_sources: { data: [{ ...SOURCE, last_content_hash: PAGE_TEXT_HASH }] } })
    stubWeb()
    const { POST } = await import('@/app/api/admin/scrape-schemes/route')
    const summary = await (await POST(request())).json()
    expect(summary).toMatchObject({ skippedUnchanged: 1, newCandidates: 0 })
    expect(state.anthropicCreate).not.toHaveBeenCalled()
  })

  it('counts irrelevant pages without creating a candidate', async () => {
    const mock = setup()
    stubWeb()
    extraction({ relevant: false })
    const { POST } = await import('@/app/api/admin/scrape-schemes/route')
    const summary = await (await POST(request())).json()
    expect(summary).toMatchObject({ skippedIrrelevant: 1, newCandidates: 0 })
    expect(mock.callsTo('scheme_candidates', 'insert')).toHaveLength(0)
  })

  it('records a failing source and keeps going instead of crashing', async () => {
    setup()
    stubWeb({ pageOk: false })
    const { POST } = await import('@/app/api/admin/scrape-schemes/route')
    const res = await POST(request())
    expect(res.status).toBe(200)
    expect((await res.json()).errors).toEqual(['Handloom: HTTP 503'])
  })

  it('returns 500 when the source list cannot be loaded', async () => {
    setup({ scheme_sources: { error: { message: 'permission denied' } } })
    const { POST } = await import('@/app/api/admin/scrape-schemes/route')
    const res = await POST(request())
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('permission denied')
  })
})
