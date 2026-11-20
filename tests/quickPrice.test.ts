import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parsePriceQuestion, quickPriceAnswer } from '@/lib/quickPrice'

// Typed price questions are answered by the calculator straight away,
// without waiting for an AI model. Anything unclear is left to the agent.

describe('parsePriceQuestion', () => {
  it.each([
    ['Materials cost 1500 rupees and it took 20 hours. What should I charge?', 1500, 20],
    ['What price should I put on my saree? Materials cost 1,500 rupees and it took 20 hours.', 1500, 20],
    ['सामान 1500 रुपये का है और 20 घंटे लगे। कितनी कीमत रखूं?', 1500, 20],
    ['నా చీరకు మెటీరియల్ 1500 రూపాయలు, 20 గంటలు పని. ఎంత ధర పెట్టాలి?', 1500, 20],
    ['பொருட்களுக்கு 1500 ரூபாய், 20 மணி நேர வேலை. என்ன விலை வைக்கலாம்?', 1500, 20],
    ['উপকরণে ৬০০ টাকা খরচ হয়েছে, ১০ ঘণ্টা কাজ। কত দাম রাখব?', 600, 10],
    ['سامان 1500 روپے کا ہے اور 20 گھنٹے لگے۔ کتنی قیمت رکھوں؟', 1500, 20],
    ['My pot used 600 rupees of clay and paint and took 10 hours. Fair price?', 600, 10],
    ['It took 12 hrs and ₹800 of thread', 800, 12],
    ['Rs. 450 material, 6 hours', 450, 6],
    ['१२०० रुपये सामान, ८ घंटे', 1200, 8],
  ])('reads %s', (text, material, hours) => {
    expect(parsePriceQuestion(text)).toEqual({ materialCostInr: material, hoursOfWork: hours })
  })

  it.each([
    ['How much should I charge for a saree?'],
    ['Materials 2000 rupees, 30 hours of work, and I want 250 rupees an hour. What price?'],
    ['I want 250 rupees per hour and it took 30 hours'],
    ['I worked 20 hours and sold 3 sarees'],
    ['I made 2 sarees for 1500 rupees'],
    ['Are there any government schemes for weavers?'],
    [''],
    ['Materials 1500 rupees and 0 hours'],
  ])('leaves %s to the agent', (text) => {
    expect(parsePriceQuestion(text)).toBeNull()
  })
})

describe('quickPriceAnswer', () => {
  it('returns the calculator result with a reply in the chosen language', () => {
    const r = quickPriceAnswer('నా చీరకు మెటీరియల్ 1500 రూపాయలు, 20 గంటలు పని. ఎంత ధర పెట్టాలి?', 'te')
    expect(r).not.toBeNull()
    expect(r!.actions[0]).toMatchObject({ type: 'price', result: { fairPrice: 7860, minimumPrice: 5500 } })
    expect(r!.toolsUsed).toEqual(['suggest_fair_price'])
    expect(r!.model).toBe('kalasetu/price-calculator')
    // Every number of the breakdown, in Telugu words around them.
    for (const amount of ['₹1,500', '₹200', '₹4,000', '₹5,500', '₹7,860', '₹9,250']) expect(r!.reply).toContain(amount)
    expect(r!.reply).toMatch(/[ఀ-౿]/)
    expect(r!.reply).not.toMatch(/\{\{/)
  })

  it('explains the whole breakdown in English when no language is chosen', () => {
    const r = quickPriceAnswer('Materials cost 1500 rupees and it took 20 hours.', undefined)
    expect(r!.reply).toBe(
      'Your materials cost ₹1,500, and 20 hours of work at ₹200 an hour is ₹4,000, so your total cost is ₹5,500. ' +
      'With a 30% profit on top, a fair price is ₹7,860. ' +
      'Never sell below ₹5,500, because that only covers your materials and your time. ' +
      'If you sell online, ask ₹9,250, so that after the platform fee you still keep the fair price.',
    )
  })

  it('returns null for questions it cannot read', () => {
    expect(quickPriceAnswer('How much for a saree?', 'en')).toBeNull()
  })
})

describe('runVoiceAgent price shortcut', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.GEMINI_API_KEY = 'k'
  })
  afterEach(() => vi.unstubAllGlobals())

  it('answers a typed price question without calling any AI or the database', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const data = { findSchemes: vi.fn(), listProducts: vi.fn(), getProfile: vi.fn() }
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const r = await runVoiceAgent({ text: 'Materials cost 1500 rupees and it took 20 hours. Price?', language: 'en', data })
    expect(r.actions[0]).toMatchObject({ type: 'price', result: { fairPrice: 7860 } })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(data.findSchemes).not.toHaveBeenCalled()
  })

  it('leaves spoken questions to the agent, which listens to the audio', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => '', json: async () => ({ candidates: [{ content: { parts: [{ text: 'REPLY: From Gemini.' }] } }] }) }))
    vi.stubGlobal('fetch', fetchMock)
    const data = { findSchemes: vi.fn(async () => []), listProducts: vi.fn(async () => ({ total: 0, items: [] })), getProfile: vi.fn(async () => null) }
    const { runVoiceAgent } = await import('@/lib/voiceAgent')
    const r = await runVoiceAgent({ text: 'Spoken audio', audio: { mimeType: 'audio/wav', data: 'UklGRg==' }, language: 'en', data })
    expect(r.reply).toBe('From Gemini.')
  })
})
