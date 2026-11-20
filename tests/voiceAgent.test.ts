import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createSupabaseMock } from './helpers/supabaseMock'

// Saathi Voice Agent: fair-price maths, WAV encoding, the Gemini
// function-calling loop, the data tools, and both API routes.

const state = vi.hoisted(() => ({
  db: null as null | Record<string, unknown>,
  requireUser: vi.fn(),
  rateLimited: false,
}))

vi.mock('@/lib/supabaseAdmin', () => ({
  get supabaseAdmin() {
    return state.db
  },
}))
vi.mock('@/lib/requireUser', () => ({ requireUser: state.requireUser }))
vi.mock('@/lib/rateLimit', () => ({ isRateLimited: () => state.rateLimited, userKey: (id: string) => `user:${id}` }))

type FetchCall = [string, RequestInit]

function reply(parts: Record<string, unknown>[]) {
  return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { role: 'model', parts } }] }), text: async () => '' }
}
const textReply = (text: string) => reply([{ text }])
const httpError = (status: number) => ({ ok: false, status, json: async () => ({}), text: async () => 'busy' })

function stubFetch(...responses: unknown[]) {
  const fetchMock = vi.fn()
  for (const r of responses) fetchMock.mockResolvedValueOnce(r)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
const bodyOf = (fetchMock: ReturnType<typeof vi.fn>, i: number) => JSON.parse((fetchMock.mock.calls[i] as FetchCall)[1].body as string)
const modelOf = (fetchMock: ReturnType<typeof vi.fn>, i: number) => (fetchMock.mock.calls[i] as FetchCall)[0].match(/models\/([^:]+)/)?.[1]

const fakeData = () => ({
  findSchemes: vi.fn(async () => [{ title: 'PM Vishwakarma', type: 'scheme', deadline: null, url: 'https://pmv.gov.in' }]),
  listProducts: vi.fn(async () => ({ total: 1, items: [{ name: 'Ikat saree', material: 'silk', hasListing: false }] })),
  getProfile: vi.fn(async () => ({ name: 'Lakshmi', craft: 'handloom', state: 'Telangana', catalogueUrl: 'https://x.test/a/lakshmi' })),
})

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  process.env.GEMINI_API_KEY = 'test-key'
  delete process.env.GEMINI_AGENT_MODEL
  delete process.env.GEMINI_TTS_MODEL
  state.db = null
  state.rateLimited = false
  state.requireUser.mockResolvedValue({ ok: true, userId: 'user-1' })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.GEMINI_API_KEY
})

describe('calculateFairPrice', () => {
  it('matches the pricing calculator: ₹200/hour and a 30% margin on the selling price', async () => {
    const { calculateFairPrice } = await import('@/lib/fairPrice')
    const r = calculateFairPrice({ materialCostInr: 1500, hoursOfWork: 20 })
    // Online: after a 15% marketplace fee the artisan must still keep the
    // fair price, so 7,860 / 0.85 = 9,247 → 9,250 (not 7,860 × 1.15).
    expect(r).toMatchObject({ materials: 1500, labour: 4000, totalCost: 5500, fairPrice: 7860, minimumPrice: 5500, onlinePrice: 9250 })
    expect(r.onlinePrice * 0.85).toBeGreaterThanOrEqual(r.fairPrice)
    expect(r.profit).toBe(7860 - 5500)
  })

  it('uses the wage, other costs and margin given', async () => {
    const { calculateFairPrice } = await import('@/lib/fairPrice')
    const r = calculateFairPrice({ materialCostInr: 100, hoursOfWork: 2, hourlyWageInr: 50, otherCostsInr: 50, marginPercent: 50 })
    expect(r).toMatchObject({ labour: 100, totalCost: 250, fairPrice: 500, marginPercent: 50 })
  })

  it('never produces NaN, negative or runaway numbers from bad input', async () => {
    const { calculateFairPrice } = await import('@/lib/fairPrice')
    const r = calculateFairPrice({ materialCostInr: Number.NaN, hoursOfWork: -5, marginPercent: 150 })
    expect(r).toMatchObject({ materials: 0, labour: 0, totalCost: 0, fairPrice: 0, marginPercent: 90 })
  })
})

describe('WAV encoding', () => {
  it('writes a valid 16 kHz mono 16-bit header and clamps samples', async () => {
    const { encodeWav } = await import('@/lib/wav')
    const bytes = encodeWav(new Float32Array([0, 1, -1, 2]))
    const view = new DataView(bytes.buffer)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getUint16(34, true)).toBe(16)
    expect(view.getUint32(40, true)).toBe(8)
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767])
  })

  it('mixes stereo to mono and resamples 48 kHz down to 16 kHz', async () => {
    const { toMono16k } = await import('@/lib/wav')
    const left = new Float32Array(4800).fill(0.5)
    const right = new Float32Array(4800).fill(-0.5)
    const out = toMono16k([left, right], 48000)
    expect(out.length).toBe(1600)
    expect(Math.max(...out.map(Math.abs))).toBeCloseTo(0, 5)
    expect(toMono16k([], 48000).length).toBe(0)
  })

  it('base64-encodes bytes and measures the peak level', async () => {
    const { bytesToBase64, peakLevel } = await import('@/lib/wav')
    expect(bytesToBase64(new TextEncoder().encode('RIFF'))).toBe('UklGRg==')
    expect(peakLevel(new Float32Array([0.1, -0.7, 0.3]))).toBeCloseTo(0.7)
  })
})

describe('parseAgentText', () => {
  it('splits the HEARD and REPLY lines', async () => {
    const { parseAgentText } = await import('@/lib/voiceAgent')
    expect(parseAgentText('HEARD: ధర ఎంత?\nREPLY: ₹7,860 పెట్టండి — సరైన ధర.')).toEqual({ heard: 'ధర ఎంత?', reply: '₹7,860 పెట్టండి, సరైన ధర.', cards: [] })
  })

  it('uses the whole text as the reply when the model skips the format', async () => {
    const { parseAgentText } = await import('@/lib/voiceAgent')
    expect(parseAgentText('**Charge ₹500.**')).toEqual({ heard: null, reply: 'Charge ₹500.', cards: [] })
  })
})

describe('one-call answers from preloaded facts', () => {
  it('reads the CARDS line and keeps it out of the spoken reply', async () => {
    const { parseAgentText } = await import('@/lib/voiceAgent')
    expect(parseAgentText('HEARD: schemes?\nREPLY: PM Vishwakarma is open.\nCARDS: schemes')).toEqual({ heard: 'schemes?', reply: 'PM Vishwakarma is open.', cards: ['schemes'] })
    expect(parseAgentText('REPLY: Here it is.\nCARDS: catalogue, junk')).toMatchObject({ reply: 'Here it is.', cards: ['catalogue'] })
  })

  it('gives Gemini the schemes, profile and products as facts', async () => {
    const fetchMock = stubFetch(textReply('REPLY: ok\nCARDS: none'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    await runVoiceAgent({ text: 'hi', data: fakeData() })
    const system = bodyOf(fetchMock, 0).systemInstruction.parts[0].text as string
    expect(system).toContain('Open schemes and opportunities: PM Vishwakarma (scheme)')
    expect(system).toContain('The artisan: Lakshmi, handloom, Telangana. Public catalogue link: https://x.test/a/lakshmi')
    expect(system).toContain('Their products (1): Ikat saree in silk (needs a listing)')
  })

  it('answers a schemes question in one model call and still shows the scheme cards', async () => {
    const fetchMock = stubFetch(textReply('HEARD: schemes?\nREPLY: PM Vishwakarma is open for weavers.\nCARDS: schemes'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'Any schemes for weavers?', data: fakeData() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ reply: 'PM Vishwakarma is open for weavers.', toolsUsed: [] })
    expect(result.actions).toEqual([{ type: 'schemes', items: [{ title: 'PM Vishwakarma', type: 'scheme', deadline: null, url: 'https://pmv.gov.in' }] }])
  })

  it('shows the catalogue card when the answer gives the link', async () => {
    stubFetch(textReply('REPLY: Your link is ready.\nCARDS: catalogue'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'my catalogue link', data: fakeData() })
    expect(result.actions).toEqual([{ type: 'catalogue', url: 'https://x.test/a/lakshmi' }])
  })

  it('opens a screen from the CARDS line in one call, and ignores screens that do not exist', async () => {
    const fetchMock = stubFetch(textReply('REPLY: Opening the photoshoot for you.\nCARDS: open:photoshoot open:admin'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'I want a photo of my saree', data: fakeData() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.actions).toEqual([{ type: 'open', screen: 'photoshoot', path: '/studio', label: 'AI Photoshoot' }])
  })

  it("asks for replies in each language's own script and hands over to Groq after 9 seconds", async () => {
    const fetchMock = stubFetch(textReply('REPLY: ok'))
    const { runVoiceAgent, AGENT_GEMINI_BUDGET_MS } = await import('@/lib/voiceAgent')
    await runVoiceAgent({ text: 'hi', language: 'te', data: fakeData() })
    expect(bodyOf(fetchMock, 0).systemInstruction.parts[0].text).toContain("Always reply in Telugu, written in Telugu's own script")
    expect(AGENT_GEMINI_BUDGET_MS).toBe(9_000)
  })

  it('still answers when a database read fails, leaving that fact out', async () => {
    const data = fakeData()
    data.listProducts.mockRejectedValue(new Error('db down'))
    const fetchMock = stubFetch(textReply('REPLY: ok'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    await runVoiceAgent({ text: 'hi', data })
    const system = bodyOf(fetchMock, 0).systemInstruction.parts[0].text as string
    expect(system).not.toContain('Their products')
    expect(system).toContain('Open schemes and opportunities')
  })
})

describe('runVoiceAgent', () => {
  it('runs the pricing tool, sends the result back, and returns the spoken reply with a price card', async () => {
    const fetchMock = stubFetch(
      reply([{ functionCall: { name: 'suggest_fair_price', args: { material_cost_inr: 1500, hours_of_work: 20 }, id: 'c1' }, thoughtSignature: 'sig' }]),
      textReply('HEARD: What should I charge?\nREPLY: Charge 7,860 rupees.'),
    )
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'What should I charge?', language: 'en', data: fakeData() })

    expect(result).toMatchObject({ heard: 'What should I charge?', reply: 'Charge 7,860 rupees.', toolsUsed: ['suggest_fair_price'], model: 'gemini-3.1-flash-lite' })
    expect(result.actions[0]).toMatchObject({ type: 'price', result: { fairPrice: 7860 } })

    const second = bodyOf(fetchMock, 1)
    // The model's own turn goes back unchanged, thought signature included,
    // followed by the tool result answering its call id.
    expect(second.contents[1]).toEqual({ role: 'model', parts: [{ functionCall: { name: 'suggest_fair_price', args: { material_cost_inr: 1500, hours_of_work: 20 }, id: 'c1' }, thoughtSignature: 'sig' }] })
    expect(second.contents[2].parts[0].functionResponse).toMatchObject({ name: 'suggest_fair_price', id: 'c1', response: { fairPrice: 7860 } })
    expect(second.tools[0].functionDeclarations.map((f: { name: string }) => f.name)).toEqual([
      'suggest_fair_price', 'find_schemes', 'search_schemes_online', 'get_my_products', 'get_my_profile', 'open_screen',
    ])
  })

  it('sends recorded audio to Gemini and tells it which language to answer in', async () => {
    const fetchMock = stubFetch(textReply('HEARD: నమస్తే\nREPLY: నమస్తే!'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ audio: { mimeType: 'audio/wav', data: 'UklGRg==' }, language: 'te', data: fakeData() })
    const body = bodyOf(fetchMock, 0)
    expect(body.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'audio/wav', data: 'UklGRg==' } })
    expect(body.systemInstruction.parts[0].text).toContain('Always reply in Telugu')
    expect(result.heard).toBe('నమస్తే')
  })

  it('includes recent conversation history', async () => {
    const fetchMock = stubFetch(textReply('REPLY: ok'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    await runVoiceAgent({
      text: 'And for two?',
      history: [{ role: 'user', content: 'Price one saree' }, { role: 'assistant', content: '₹7,860' }],
      data: fakeData(),
    })
    expect(bodyOf(fetchMock, 0).contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user'])
  })

  it('finds schemes, reads profile and products, and opens only real screens', async () => {
    const data = fakeData()
    stubFetch(
      reply([
        { functionCall: { name: 'find_schemes', args: { keyword: 'handloom', type: 'lottery' } } },
        { functionCall: { name: 'get_my_profile', args: {} } },
        { functionCall: { name: 'get_my_products', args: {} } },
        { functionCall: { name: 'open_screen', args: { screen: 'photoshoot' } } },
        { functionCall: { name: 'open_screen', args: { screen: '../admin' } } },
      ]),
      textReply('REPLY: Done.'),
    )
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'help', data })
    expect(data.findSchemes).toHaveBeenCalledWith('handloom', null)
    expect(result.actions.map((a) => a.type)).toEqual(['schemes', 'catalogue', 'open'])
    expect(result.actions[2]).toMatchObject({ path: '/studio' })
  })

  it('reports a failing tool to the model instead of crashing', async () => {
    const data = fakeData()
    data.findSchemes.mockRejectedValue(new Error('db down'))
    const fetchMock = stubFetch(reply([{ functionCall: { name: 'find_schemes', args: {} } }]), textReply('REPLY: Sorry, try later.'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'schemes', data })
    expect(result.reply).toBe('Sorry, try later.')
    expect(bodyOf(fetchMock, 1).contents[2].parts[0].functionResponse.response).toEqual({ error: 'This tool is unavailable right now.' })
  })

  it('retries the fast model once when it is busy, since overload spikes pass quickly', async () => {
    const fetchMock = stubFetch(httpError(503), textReply('REPLY: Hello.'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'hi', data: fakeData() })
    expect([0, 1].map((i) => modelOf(fetchMock, i))).toEqual(['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite'])
    expect(result).toMatchObject({ reply: 'Hello.', model: 'gemini-3.1-flash-lite' })
  })

  it('moves to the next Gemini model when the fast one is busy twice, then stays on it', async () => {
    const fetchMock = stubFetch(
      httpError(503),
      httpError(503),
      reply([{ functionCall: { name: 'get_my_products', args: {} } }]),
      textReply('REPLY: You have one saree.'),
    )
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'my products', data: fakeData() })
    expect([0, 1, 2, 3].map((i) => modelOf(fetchMock, i))).toEqual(['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash-lite'])
    expect(result.model).toBe('gemini-3.5-flash-lite')
  })

  it('retries the same model when it stalls after a tool call, instead of failing the answer', async () => {
    const fetchMock = stubFetch(
      reply([{ functionCall: { name: 'get_my_products', args: {} } }]),
      httpError(503),
      textReply('REPLY: You have one saree.'),
    )
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'my products', data: fakeData() })
    expect(result.reply).toBe('You have one saree.')
    expect([0, 1, 2].map((i) => modelOf(fetchMock, i))).toEqual(['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.1-flash-lite'])
  })

  it('does not retry a model that stalled until timeout; moves straight on', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })
    const fetchMock = vi.fn().mockRejectedValueOnce(timeout).mockResolvedValueOnce(textReply('REPLY: Hi.'))
    vi.stubGlobal('fetch', fetchMock)
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'hi', data: fakeData() })
    expect([0, 1].map((i) => modelOf(fetchMock, i))).toEqual(['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'])
    expect(result.reply).toBe('Hi.')
  })

  it('treats an empty reply as a failed attempt and tries again', async () => {
    const empty = { ok: true, status: 200, text: async () => '', json: async () => ({ candidates: [{ content: { parts: [{ text: '', thought: true }] }, finishReason: 'MAX_TOKENS' }] }) }
    const fetchMock = stubFetch(empty, textReply('REPLY: Here you go.'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'hi', data: fakeData() })
    expect(result.reply).toBe('Here you go.')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('starts a backup request after 3 seconds and uses whichever answers first', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const fetchMock = vi.fn()
        .mockImplementationOnce(() => new Promise(() => {})) // first call hangs
        .mockResolvedValueOnce(textReply('REPLY: Backup answered.'))
      vi.stubGlobal('fetch', fetchMock)
      const { runVoiceAgent, AGENT_HEDGE_AFTER_MS } = await import('@/lib/voiceAgent')
      const pending = runVoiceAgent({ text: 'hi', data: fakeData() })
      await vi.advanceTimersByTimeAsync(AGENT_HEDGE_AFTER_MS - 100)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(200)
      const result = await pending
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.reply).toBe('Backup answered.')
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not start a backup when the first answer is quick', async () => {
    const fetchMock = stubFetch(textReply('REPLY: Quick.'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    await runVoiceAgent({ text: 'hi', data: fakeData() })
    await new Promise((r) => setTimeout(r, 50))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('after a 429 (quota used up) goes straight to a different model', async () => {
    const quota = { ok: false, status: 429, text: async () => 'quota', json: async () => ({}) }
    const fetchMock = stubFetch(quota, textReply('REPLY: From another model.'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'hi', data: fakeData() })
    expect([0, 1].map((i) => modelOf(fetchMock, i))).toEqual(['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'])
    expect(result.reply).toBe('From another model.')
  })

  it('caps every attempt at 12 seconds and the whole answer at 45 seconds', async () => {
    const { attemptOrder, AGENT_ATTEMPT_TIMEOUT_MS, AGENT_TOTAL_BUDGET_MS } = await import('@/lib/voiceAgent')
    expect(AGENT_ATTEMPT_TIMEOUT_MS).toBe(12_000)
    expect(AGENT_TOTAL_BUDGET_MS).toBeLessThan(60_000)
    expect(attemptOrder(['a', 'b'])).toEqual(['a', 'a', 'b'])
    expect(attemptOrder([])).toEqual([])
  })

  it('stops trying once the overall time budget is spent', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const start = Date.now()
    const fetchMock = vi.fn(async () => {
      vi.setSystemTime(start + 44_500) // the first attempt eats almost the whole budget
      return httpError(503)
    })
    vi.stubGlobal('fetch', fetchMock)
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    await expect(runVoiceAgent({ text: 'hi', data: fakeData() })).rejects.toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('gives up after a bounded number of tool rounds', async () => {
    const loop = reply([{ functionCall: { name: 'get_my_products', args: {} } }])
    stubFetch(loop, loop, loop, loop, loop)
    const { runVoiceAgent, MAX_AGENT_STEPS } = await import('@/lib/voiceAgent')
    await expect(runVoiceAgent({ text: 'x', data: fakeData() })).rejects.toThrow(/too many tool steps/)
    expect(MAX_AGENT_STEPS).toBe(4)
  })
})

describe('live scheme search (Google Search grounding)', () => {
  const grounded = (text: string, chunks: unknown[]) => ({
    ok: true, status: 200, text: async () => '',
    json: async () => ({ candidates: [{ content: { parts: [{ text }] }, groundingMetadata: { groundingChunks: chunks } }] }),
  })

  it('returns the live answer with de-duplicated https sources', async () => {
    const fetchMock = stubFetch(grounded('PM Vishwakarma offers loans up to 3 lakh.', [
      { web: { uri: 'https://pmvishwakarma.gov.in', title: 'PM Vishwakarma' } },
      { web: { uri: 'https://pmvishwakarma.gov.in', title: 'duplicate' } },
      { web: { uri: 'http://insecure.example', title: 'insecure' } },
      { web: { uri: 'https://handlooms.nic.in/schemes', title: '' } },
    ]))
    const { geminiGrounded } = await import('@/lib/gemini')
    const result = await geminiGrounded({ prompt: 'weaver schemes' })
    expect(result.text).toContain('PM Vishwakarma')
    expect(result.sources).toEqual([
      { title: 'PM Vishwakarma', url: 'https://pmvishwakarma.gov.in' },
      { title: 'handlooms.nic.in', url: 'https://handlooms.nic.in/schemes' },
    ])
    expect(bodyOf(fetchMock, 0).tools).toEqual([{ google_search: {} }])
  })

  it('stops after a quota error instead of trying every model', async () => {
    const fetchMock = stubFetch(httpError(429), httpError(429), httpError(429))
    const { geminiGrounded } = await import('@/lib/gemini')
    await expect(geminiGrounded({ prompt: 'x' })).rejects.toMatchObject({ status: 429 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('the agent shows live sources when search works', async () => {
    stubFetch(
      reply([{ functionCall: { name: 'search_schemes_online', args: { question: 'new handloom schemes Telangana' } } }]),
      grounded('The Handloom Weavers Comprehensive Welfare Scheme is open.', [{ web: { uri: 'https://handlooms.nic.in', title: 'Handlooms' } }]),
      textReply('REPLY: There is a welfare scheme open now.'),
    )
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'new schemes?', data: fakeData() })
    expect(result.actions[0]).toMatchObject({ type: 'web', sources: [{ url: 'https://handlooms.nic.in' }] })
  })

  it('the agent falls back to the approved list when live search is unavailable', async () => {
    const fetchMock = stubFetch(
      reply([{ functionCall: { name: 'search_schemes_online', args: { question: 'schemes' } } }]),
      httpError(429),
      textReply('REPLY: PM Vishwakarma is open.'),
    )
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'schemes?', data: fakeData() })
    expect(result.reply).toBe('PM Vishwakarma is open.')
    expect(bodyOf(fetchMock, 2).contents[2].parts[0].functionResponse.response.error).toMatch(/not available/)
    expect(result.actions).toEqual([])
  })
})

describe('createDataSource', () => {
  it('scopes products and profile to the signed-in user and builds the catalogue link', async () => {
    const mock = createSupabaseMock({
      products: { data: [{ name: 'Saree', material: 'silk', description: 'Lovely' }], count: 3 },
      artisan_profiles: { data: { name: 'Lakshmi', craft_type: 'handloom', state: 'TS', public_slug: 'lakshmi', catalogue_published: true } },
    })
    state.db = { from: mock.from }
    process.env.NEXT_PUBLIC_APP_URL = 'https://kalasetu.test/'
    const { createDataSource } = await import('@/lib/voiceAgentData')
    const source = createDataSource('user-1')
    expect(await source.listProducts()).toEqual({ total: 3, items: [{ name: 'Saree', material: 'silk', hasListing: true }] })
    expect(await source.getProfile()).toMatchObject({ catalogueUrl: 'https://kalasetu.test/a/lakshmi' })
    expect(mock.callsTo('products', 'eq')).toContainEqual(['user_id', 'user-1'])
    expect(mock.callsTo('artisan_profiles', 'eq')).toContainEqual(['id', 'user-1'])
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  it('keeps filter syntax out of the scheme keyword and falls back to all open schemes', async () => {
    const mock = createSupabaseMock({ opportunities: [{ data: [] }, { data: [{ title: 'Grant', type: 'scheme', deadline: null, official_url: 'u' }] }] })
    state.db = { from: mock.from }
    const { createDataSource } = await import('@/lib/voiceAgentData')
    const items = await createDataSource('user-1').findSchemes('loan),id.eq.1,(%', null)
    expect(items).toEqual([{ title: 'Grant', type: 'scheme', deadline: null, url: 'u' }])
    const keywordFilter = mock.callsTo('opportunities', 'or').map(([f]) => f as string).find((f) => f.includes('ilike'))
    expect(keywordFilter).toBe('title.ilike.%loan id eq 1%,description.ilike.%loan id eq 1%')
  })

  it('returns nothing personal without a user or database', async () => {
    const { createDataSource } = await import('@/lib/voiceAgentData')
    const source = createDataSource(null)
    expect(await source.listProducts()).toEqual({ total: 0, items: [] })
    expect(await source.getProfile()).toBeNull()
    expect(await source.findSchemes('x', null)).toEqual([])
  })
})

describe('POST /api/voice-agent', () => {
  const request = (body: unknown) => new NextRequest('http://localhost/api/voice-agent', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })

  it('rejects signed-out callers before calling Gemini', async () => {
    state.requireUser.mockResolvedValue({ ok: false, userId: null })
    const fetchMock = stubFetch()
    const { POST } = await import('@/app/api/voice-agent/route')
    expect((await POST(request({ text: 'hi' }))).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['no question', {}],
    ['a non-audio file', { audio: { mimeType: 'image/png', data: 'AAAA' } }],
    ['invalid base64', { audio: { mimeType: 'audio/wav', data: 'not base64!' } }],
    ['an oversized recording', { audio: { mimeType: 'audio/wav', data: 'A'.repeat(3_000_004) } }],
  ])('returns 400 for %s', async (_label, body) => {
    const fetchMock = stubFetch()
    const { POST } = await import('@/app/api/voice-agent/route')
    expect((await POST(request(body))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rate limits and needs a Gemini key', async () => {
    const { POST } = await import('@/app/api/voice-agent/route')
    state.rateLimited = true
    expect((await POST(request({ text: 'hi' }))).status).toBe(429)
    state.rateLimited = false
    delete process.env.GEMINI_API_KEY
    expect((await POST(request({ text: 'hi' }))).status).toBe(503)
  })

  it('answers a typed question end to end', async () => {
    stubFetch(textReply('HEARD: hello\nREPLY: Namaste! How can I help your craft business?'))
    const { POST } = await import('@/app/api/voice-agent/route')
    const res = await POST(request({ text: 'hello', language: 'en', history: [{ role: 'assistant', content: 'hi' }, 'junk'] }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ reply: 'Namaste! How can I help your craft business?', actions: [] })
  })

  it('returns a generic message when every Gemini model fails', async () => {
    stubFetch(httpError(503), httpError(503), httpError(429))
    const { POST } = await import('@/app/api/voice-agent/route')
    const res = await POST(request({ text: 'hello' }))
    expect(res.status).toBe(503)
    const text = JSON.stringify(await res.json())
    expect(text).not.toMatch(/HTTP|503|gemini|at \//i)
  })
})

describe('POST /api/speak', () => {
  const request = (body: unknown) => new NextRequest('http://localhost/api/speak', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })

  it('returns Gemini speech in the requested language', async () => {
    const fetchMock = stubFetch(reply([{ inlineData: { mimeType: 'audio/wav', data: 'UklGRg==' } }]))
    const { POST } = await import('@/app/api/speak/route')
    const res = await POST(request({ text: 'నమస్తే', language: 'te' }))
    expect(await res.json()).toEqual({ audioDataUrl: 'data:audio/wav;base64,UklGRg==' })
    const body = bodyOf(fetchMock, 0)
    expect(modelOf(fetchMock, 0)).toBe('gemini-3.8-flash-tts')
    expect(body.generationConfig.responseModalities).toEqual(['AUDIO'])
    // Only the words to speak: the speech models sometimes read an
    // instruction aloud ("Say this in a warm voice…"), so none is sent.
    expect(body.contents[0].parts[0].text).toBe('నమస్తే')
  })

  it('tries the lighter speech model when the first is rate limited', async () => {
    const fetchMock = stubFetch(httpError(429), reply([{ inlineData: { mimeType: 'audio/wav', data: 'QQ==' } }]))
    const { POST } = await import('@/app/api/speak/route')
    expect((await POST(request({ text: 'hi' }))).status).toBe(200)
    expect(modelOf(fetchMock, 1)).toBe('gemini-3.8-flash-lite-tts')
  })

  it('speaks a detailed reply longer than 800 characters in full', async () => {
    const fetchMock = stubFetch(reply([{ inlineData: { mimeType: 'audio/wav', data: 'UklGRg==' } }]))
    const { POST } = await import('@/app/api/speak/route')
    const long = 'మీ సామగ్రి ఖర్చు ₹1,500. '.repeat(50).slice(0, 1200)
    expect((await POST(request({ text: long, language: 'te' }))).status).toBe(200)
    expect(bodyOf(fetchMock, 0).contents[0].parts[0].text).toBe(long.trim())
  })

  it('validates input and auth, and fails with a generic 503 the page can fall back from', async () => {
    const { POST } = await import('@/app/api/speak/route')
    expect((await POST(request({ text: '' }))).status).toBe(400)
    expect((await POST(request({ text: 'x'.repeat(1601) }))).status).toBe(400)
    stubFetch(httpError(429), httpError(429))
    const failed = await POST(request({ text: 'hi' }))
    expect(failed.status).toBe(503)
    expect(await failed.json()).toEqual({ error: 'Speech unavailable' })
    state.requireUser.mockResolvedValue({ ok: false, userId: null })
    expect((await POST(request({ text: 'hi' }))).status).toBe(401)
  })
})
