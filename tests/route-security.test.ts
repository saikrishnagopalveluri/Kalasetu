import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Cross-cutting guarantees checked against every route that spends money
// (AI text, image generation) or writes user data, so a new route or a
// refactor can't quietly drop them:
//   1. an unauthenticated caller is turned away before any provider is called
//   2. when a provider fails, the response never leaks internal details

const SECRET_DETAIL = 'at /var/task/lib/secret.ts:42 sk-ant-api03-LEAKED db_password=hunter2'

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  anthropicCreate: vi.fn(),
  groqCreate: vi.fn(),
  generateImage: vi.fn(),
  checkAndAwardBadges: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/requireUser', () => ({ requireUser: mocks.requireUser }))
vi.mock('@/lib/rateLimit', () => ({
  isRateLimited: () => false,
  userKey: (id: string) => `user:${id}`,
  clientKey: () => 'ip',
}))
vi.mock('@/lib/imageProviders', () => ({
  generateImage: mocks.generateImage,
  AllProvidersFailedError: class extends Error {},
}))
vi.mock('@/lib/badges', () => ({ checkAndAwardBadges: mocks.checkAndAwardBadges }))
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: { from: mocks.from, auth: { admin: { getUserById: vi.fn() } } },
}))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mocks.anthropicCreate }
  },
}))
vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: mocks.groqCreate } }
  },
}))

type Handler = (request: NextRequest) => Promise<Response>
type RouteCase = {
  name: string
  load: () => Promise<Handler>
  method: 'GET' | 'POST'
  body?: Record<string, unknown>
}

const VALID_STORY = { title: 'My loom', content: 'I weave cotton every morning.', language: 'en', category: 'My Craft Story' }

const PROTECTED_ROUTES: RouteCase[] = [
  { name: '/api/ai', method: 'POST', load: async () => (await import('@/app/api/ai/route')).POST, body: { messages: [{ role: 'user', content: 'hi' }] } },
  { name: '/api/photoshoot', method: 'POST', load: async () => (await import('@/app/api/photoshoot/route')).POST, body: { productName: 'Saree' } },
  { name: '/api/design-image', method: 'POST', load: async () => (await import('@/app/api/design-image/route')).POST, body: { craftType: 'Kalamkari' } },
  { name: '/api/story-evaluate', method: 'POST', load: async () => (await import('@/app/api/story-evaluate/route')).POST, body: VALID_STORY },
  { name: '/api/story-publish', method: 'POST', load: async () => (await import('@/app/api/story-publish/route')).POST, body: VALID_STORY },
  { name: '/api/referral', method: 'POST', load: async () => (await import('@/app/api/referral/route')).POST, body: { action: 'register', code: 'ABC' } },
  { name: '/api/module-complete-hook', method: 'POST', load: async () => (await import('@/app/api/module-complete-hook/route')).POST, body: {} },
  { name: '/api/saathi-dashboard', method: 'GET', load: async () => (await import('@/app/api/saathi-dashboard/route')).GET },
]

function request(route: RouteCase) {
  return new NextRequest(`http://localhost${route.name}`, {
    method: route.method,
    headers: { 'content-type': 'application/json' },
    ...(route.method === 'POST' ? { body: JSON.stringify(route.body ?? {}) } : {}),
  })
}

describe('route security invariants', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    process.env.GROQ_API_KEY = 'test-groq'
  })

  describe.each(PROTECTED_ROUTES)('$name', (route) => {
    it('returns 401 to an unauthenticated caller without calling any provider or database', async () => {
      mocks.requireUser.mockResolvedValue({ ok: false, userId: null })
      const handler = await route.load()
      const response = await handler(request(route))
      expect(response.status).toBe(401)
      expect(mocks.anthropicCreate).not.toHaveBeenCalled()
      expect(mocks.groqCreate).not.toHaveBeenCalled()
      expect(mocks.generateImage).not.toHaveBeenCalled()
      expect(mocks.from).not.toHaveBeenCalled()
    })
  })

  const PROVIDER_ROUTES = PROTECTED_ROUTES.filter((r) =>
    ['/api/ai', '/api/photoshoot', '/api/design-image', '/api/story-evaluate', '/api/story-publish'].includes(r.name)
  )

  describe.each(PROVIDER_ROUTES)('$name', (route) => {
    it('hides provider error details from the client when every provider fails', async () => {
      mocks.requireUser.mockResolvedValue({ ok: true, userId: 'user-1' })
      mocks.anthropicCreate.mockRejectedValue(new Error(SECRET_DETAIL))
      mocks.groqCreate.mockRejectedValue(new Error(SECRET_DETAIL))
      mocks.generateImage.mockRejectedValue(new Error(SECRET_DETAIL))

      const handler = await route.load()
      const response = await handler(request(route))
      const text = await response.text()

      expect(response.status).toBeGreaterThanOrEqual(500)
      expect(JSON.parse(text)).toEqual({ error: expect.any(String) })
      for (const fragment of ['/var/task', 'sk-ant', 'hunter2', 'secret.ts', 'Error:']) {
        expect(text).not.toContain(fragment)
      }
    })
  })
})
