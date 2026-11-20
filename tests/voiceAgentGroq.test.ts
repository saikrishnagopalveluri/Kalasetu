import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Groq fallback for the voice agent: used only when every Gemini model
// failed, with the same tools, facts and instructions.

const groq = vi.hoisted(() => ({ create: vi.fn(), transcribe: vi.fn() }))
vi.mock('groq-sdk', () => ({
  default: class {
    chat = { completions: { create: groq.create } }
    audio = { transcriptions: { create: groq.transcribe } }
  },
  toFile: async (buf: Buffer, name: string) => ({ name, size: buf.length }),
}))

const busy = { ok: false, status: 503, text: async () => 'overloaded', json: async () => ({}) }
const data = () => ({
  findSchemes: vi.fn(async () => [{ title: 'PM Vishwakarma', type: 'scheme', deadline: null, url: 'https://pmv.gov.in' }]),
  listProducts: vi.fn(async () => ({ total: 0, items: [] })),
  getProfile: vi.fn(async () => null),
})
const groqText = (content: string) => ({ choices: [{ message: { content } }] })
const groqTool = (name: string, args: Record<string, unknown>) => ({
  choices: [{ message: { content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name, arguments: JSON.stringify(args) } }] } }],
})

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  process.env.GEMINI_API_KEY = 'g'
  process.env.GROQ_API_KEY = 'q'
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // Every Gemini attempt is busy.
  vi.stubGlobal('fetch', vi.fn(async () => busy))
})
afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.GROQ_API_KEY
})

describe('Groq fallback', () => {
  it('prices with the real calculator when Gemini is down', async () => {
    groq.create
      .mockResolvedValueOnce(groqTool('suggest_fair_price', { material_cost_inr: 1500, hours_of_work: 20 }))
      .mockResolvedValueOnce(groqText('HEARD: price?\nREPLY: Charge 7,860 rupees.\nCARDS: none'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'Materials 1500, 20 hours. Price?', language: 'en', data: data() })
    expect(result).toMatchObject({ reply: 'Charge 7,860 rupees.', model: 'groq/openai/gpt-oss-120b', toolsUsed: ['suggest_fair_price'] })
    expect(result.actions[0]).toMatchObject({ type: 'price', result: { fairPrice: 7860 } })
    const second = groq.create.mock.calls[1][0]
    expect(second.messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'call_1' })
    expect(JSON.parse(second.messages.at(-1).content)).toMatchObject({ fairPrice: 7860 })
    expect(second.messages[0].content).toContain('Open schemes and opportunities: PM Vishwakarma')
  })

  it('transcribes a spoken question with Whisper first', async () => {
    groq.transcribe.mockResolvedValue({ text: 'నేత కార్మికులకు పథకాలు ఉన్నాయా?' })
    groq.create.mockResolvedValue(groqText('REPLY: PM విశ్వకర్మ ఉంది.\nCARDS: schemes'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ audio: { mimeType: 'audio/wav', data: 'UklGRg==' }, language: 'te', data: data() })
    expect(groq.transcribe.mock.calls[0][0]).toMatchObject({ model: 'whisper-large-v3-turbo', language: 'te' })
    expect(result.heard).toBe('నేత కార్మికులకు పథకాలు ఉన్నాయా?')
    expect(result.actions).toEqual([{ type: 'schemes', items: [{ title: 'PM Vishwakarma', type: 'scheme', deadline: null, url: 'https://pmv.gov.in' }] }])
  })

  it('does not pass a Whisper language hint for languages Whisper does not know', async () => {
    groq.transcribe.mockResolvedValue({ text: 'hello' })
    groq.create.mockResolvedValue(groqText('REPLY: ok'))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    await runVoiceAgent({ audio: { mimeType: 'audio/wav', data: 'UklGRg==' }, language: 'sat', data: data() })
    expect(groq.transcribe.mock.calls[0][0].language).toBeUndefined()
  })

  it('is not used when Gemini answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '', json: async () => ({ candidates: [{ content: { parts: [{ text: 'REPLY: From Gemini.' }] } }] }) })))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const result = await runVoiceAgent({ text: 'hi', data: data() })
    expect(result.reply).toBe('From Gemini.')
    expect(groq.create).not.toHaveBeenCalled()
  })

  it('answers a spoken price question from the calculator as soon as Whisper hears it', async () => {
    groq.transcribe.mockResolvedValue({ text: 'నా చీరకు మెటీరియల్ 1500 రూపాయలు, 20 గంటలు పని. ఎంత ధర?' })
    // Gemini never answers in this test.
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const r = await runVoiceAgent({ audio: { mimeType: 'audio/wav', data: 'UklGRg==' }, text: '', language: 'te', data: data() })
    expect(r.model).toBe('kalasetu/price-calculator')
    expect(r.heard).toContain('1500')
    expect(r.actions[0]).toMatchObject({ type: 'price', result: { fairPrice: 7860 } })
    expect(groq.create).not.toHaveBeenCalled()
  })

  it('uses the agent answer for spoken questions that are not plain price questions', async () => {
    groq.transcribe.mockResolvedValue({ text: 'Are there schemes for weavers?' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '', json: async () => ({ candidates: [{ content: { parts: [{ text: 'HEARD: schemes?\nREPLY: From Gemini.' }] } }] }) })))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const r = await runVoiceAgent({ audio: { mimeType: 'audio/wav', data: 'UklGRg==' }, text: '', language: 'en', data: data() })
    expect(r.reply).toBe('From Gemini.')
  })

  it('does not wait for Whisper when the agent answers first', async () => {
    groq.transcribe.mockImplementation(() => new Promise(() => {}))
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, text: async () => '', json: async () => ({ candidates: [{ content: { parts: [{ text: 'REPLY: From Gemini.' }] } }] }) })))
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const r = await runVoiceAgent({ audio: { mimeType: 'audio/wav', data: 'UklGRg==' }, text: '', language: 'en', data: data() })
    expect(r.reply).toBe('From Gemini.')
  })

  it('goes to Groq first for 2 minutes after Gemini fails twice in a row', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      groq.create.mockResolvedValue(groqText('REPLY: From Groq.'))
      const fetchMock = vi.fn(async () => busy)
      vi.stubGlobal('fetch', fetchMock)
      const { runVoiceAgent } = await import('@/lib/voiceAgent')
      await runVoiceAgent({ text: 'hi', data: data() })
      await runVoiceAgent({ text: 'hi', data: data() })
      const geminiCallsSoFar = fetchMock.mock.calls.length
      expect(geminiCallsSoFar).toBeGreaterThan(0)

      // Third question: Gemini is skipped entirely.
      const third = await runVoiceAgent({ text: 'hi', data: data() })
      expect(third.reply).toBe('From Groq.')
      expect(fetchMock.mock.calls.length).toBe(geminiCallsSoFar)

      // After 2 minutes Gemini is tried first again.
      vi.setSystemTime(Date.now() + 121_000)
      await runVoiceAgent({ text: 'hi', data: data() })
      expect(fetchMock.mock.calls.length).toBeGreaterThan(geminiCallsSoFar)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not skip Gemini after one failure, and a success resets the count', async () => {
    groq.create.mockResolvedValue(groqText('REPLY: From Groq.'))
    const ok = { ok: true, status: 200, text: async () => '', json: async () => ({ candidates: [{ content: { parts: [{ text: 'REPLY: From Gemini.' }] } }] }) }
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    fetchMock.mockImplementation(async () => busy)
    await runVoiceAgent({ text: 'hi', data: data() }) // failure 1
    fetchMock.mockImplementation(async () => ok)
    expect((await runVoiceAgent({ text: 'hi', data: data() })).reply).toBe('From Gemini.') // resets
    fetchMock.mockImplementation(async () => busy)
    await runVoiceAgent({ text: 'hi', data: data() }) // failure 1 again
    fetchMock.mockImplementation(async () => ok)
    expect((await runVoiceAgent({ text: 'hi', data: data() })).reply).toBe('From Gemini.')
  })

  it('falls back to Gemini when Groq fails while Gemini is being skipped', async () => {
    groq.create.mockResolvedValue(groqText('REPLY: From Groq.'))
    const fetchMock = vi.fn(async () => busy)
    vi.stubGlobal('fetch', fetchMock)
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    await runVoiceAgent({ text: 'hi', data: data() })
    await runVoiceAgent({ text: 'hi', data: data() })
    groq.create.mockRejectedValue(new Error('groq down'))
    fetchMock.mockImplementation(async () => ({ ok: true, status: 200, text: async () => '', json: async () => ({ candidates: [{ content: { parts: [{ text: 'REPLY: Gemini is back.' }] } }] }) }))
    expect((await runVoiceAgent({ text: 'hi', data: data() })).reply).toBe('Gemini is back.')
  })

  it('keeps the original error when Groq is not configured or also fails', async () => {
    delete process.env.GROQ_API_KEY
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    await expect(runVoiceAgent({ text: 'hi', data: data() })).rejects.toMatchObject({ status: 503 })
    process.env.GROQ_API_KEY = 'q'
    groq.create.mockRejectedValue(new Error('groq down'))
    await expect(runVoiceAgent({ text: 'hi', data: data() })).rejects.toMatchObject({ status: 503 })
  })
})
