import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createSupabaseMock, type QueryResult } from './helpers/supabaseMock'

const state = vi.hoisted(() => ({
  db: null as null | { from: (table: string) => unknown },
  isRateLimited: vi.fn(),
  anthropicCreate: vi.fn(),
}))

vi.mock('@/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    return state.db
  },
}))
vi.mock('@/lib/rateLimit', () => ({ isRateLimited: state.isRateLimited, clientKey: () => '1.2.3.4' }))
vi.mock('@/lib/brand', () => ({ BRAND: { name: 'KalaSetu' } }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: state.anthropicCreate }
  },
}))
vi.mock('groq-sdk', () => ({ default: class {} }))

const post = {
  slug: 'pricing-handloom',
  title: 'Pricing your handloom on Hastkatha',
  summary: 'How to price fairly.',
  content: 'Count your hours.\n\n## Materials\n\nAdd the cost of yarn.',
}

function setup(results: Record<string, QueryResult | QueryResult[]>) {
  const mock = createSupabaseMock(results)
  state.db = mock
  return mock
}

function request(body: unknown) {
  return new NextRequest('http://localhost/api/blog-translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function aiReplies(text: string) {
  state.anthropicCreate.mockResolvedValue({ content: [{ type: 'text', text }] })
}

describe('POST /api/blog-translate', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    delete process.env.GROQ_API_KEY
    state.isRateLimited.mockReturnValue(false)
  })

  it('returns 503 when the database is not configured', async () => {
    state.db = null
    const { POST } = await import('@/app/api/blog-translate/route')
    expect((await POST(request({ slug: 'x', language: 'hi' }))).status).toBe(503)
  })

  it('rate limits each client before touching the database', async () => {
    const mock = setup({})
    state.isRateLimited.mockReturnValue(true)
    const { POST } = await import('@/app/api/blog-translate/route')
    expect((await POST(request({ slug: 'x', language: 'hi' }))).status).toBe(429)
    expect(mock.from).not.toHaveBeenCalled()
  })

  it.each([
    ['malformed JSON', '{oops'],
    ['a missing slug', { language: 'hi' }],
    ['an unknown language', { slug: 'x', language: 'klingon' }],
    ['English, which is the source language', { slug: 'x', language: 'en' }],
  ])('returns 400 for %s', async (_label, body) => {
    setup({})
    const { POST } = await import('@/app/api/blog-translate/route')
    expect((await POST(request(body))).status).toBe(400)
    expect(state.anthropicCreate).not.toHaveBeenCalled()
  })

  it('serves a cached translation with the brand token resolved', async () => {
    setup({ blog_translations: { data: { title: 'मूल्य {{BRAND}}', summary: 'सारांश', content: 'पाठ' } } })
    const { POST } = await import('@/app/api/blog-translate/route')
    const res = await POST(request({ slug: post.slug, language: 'hi' }))
    expect(await res.json()).toEqual({ title: 'मूल्य KalaSetu', summary: 'सारांश', content: 'पाठ' })
    expect(state.anthropicCreate).not.toHaveBeenCalled()
  })

  it('returns 404 for a post that does not exist, without calling the AI', async () => {
    setup({ blogs: { data: null } })
    const { POST } = await import('@/app/api/blog-translate/route')
    expect((await POST(request({ slug: 'made-up', language: 'hi' }))).status).toBe(404)
    expect(state.anthropicCreate).not.toHaveBeenCalled()
  })

  it('sends the brand as a token, never a literal name, to the AI', async () => {
    setup({ blogs: { data: post } })
    aiReplies('TITLE: शीर्षक\nSUMMARY: सारांश\nCONTENT:\nपाठ')
    const { POST } = await import('@/app/api/blog-translate/route')
    await POST(request({ slug: post.slug, language: 'hi' }))
    const sent = state.anthropicCreate.mock.calls[0][0].messages[0].content as string
    expect(sent).toContain('{{BRAND}}')
    expect(sent).not.toContain('Hastkatha')
  })

  it('parses the delimited reply, strips em dashes, caches it and resolves the brand', async () => {
    const mock = setup({ blogs: { data: post } })
    aiReplies('```\nTITLE: {{BRAND}} पर मूल्य — गाइड\nSUMMARY: उचित मूल्य\nCONTENT:\nघंटे गिनें।\n\n## सामग्री\n\nधागे की लागत जोड़ें।\n```')
    const { POST } = await import('@/app/api/blog-translate/route')
    const res = await POST(request({ slug: post.slug, language: 'hi' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.title).toBe('KalaSetu पर मूल्य, गाइड')
    expect(body.content).toBe('घंटे गिनें।\n\n## सामग्री\n\nधागे की लागत जोड़ें।')

    const [row, options] = mock.callsTo('blog_translations', 'upsert')[0] as [Record<string, string>, unknown]
    expect(row).toMatchObject({ blog_slug: post.slug, language: 'hi', title: '{{BRAND}} पर मूल्य, गाइड' })
    expect(options).toEqual({ onConflict: 'blog_slug,language' })
  })

  it('returns 502 and caches nothing when the reply has no TITLE line', async () => {
    const mock = setup({ blogs: { data: post } })
    aiReplies('I am sorry, I cannot translate this.')
    const { POST } = await import('@/app/api/blog-translate/route')
    expect((await POST(request({ slug: post.slug, language: 'hi' }))).status).toBe(502)
    expect(mock.callsTo('blog_translations', 'upsert')).toHaveLength(0)
  })

  it('retries once after a rate-limit error before giving up', async () => {
    vi.useFakeTimers()
    try {
      setup({ blogs: { data: post } })
      state.anthropicCreate.mockRejectedValue(new Error('429 rate_limit_error'))
      const { POST } = await import('@/app/api/blog-translate/route')
      const pending = POST(request({ slug: post.slug, language: 'hi' }))
      await vi.advanceTimersByTimeAsync(2500)
      expect((await pending).status).toBe(502)
      expect(state.anthropicCreate).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
