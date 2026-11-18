import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  anthropicCreate: vi.fn(),
  groqCreate: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mocks.anthropicCreate }
    constructor() {}
  },
}))
vi.mock('groq-sdk', () => ({
  default: class MockGroq {
    chat = { completions: { create: mocks.groqCreate } }
    constructor() {}
  },
}))

const validScores = {
  storytelling: 8,
  clarity: 8,
  authenticity: 9,
  craftRelevance: 9,
  culturalContext: 7,
  informationalValue: 8,
  readability: 8,
  overall: 8.2,
  feedback: null,
}

function claude(text: string) {
  return { content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 10 } }
}

describe('evaluateStory', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'
    process.env.GROQ_API_KEY = 'test-groq-key'
  })

  it('parses a valid JSON score response', async () => {
    mocks.anthropicCreate.mockResolvedValue(claude(JSON.stringify(validScores)))
    const { evaluateStory } = await import('@/lib/storyEvaluator')
    await expect(evaluateStory('Story title', 'Story content')).resolves.toEqual(validScores)
  })

  it('parses JSON wrapped in markdown fences', async () => {
    mocks.anthropicCreate.mockResolvedValue(claude(```json
${JSON.stringify(validScores)}
````))
    const { evaluateStory } = await import('@/lib/storyEvaluator')
    await expect(evaluateStory('Story title', 'Story content')).resolves.toEqual(validScores)
  })

  it('returns null for malformed JSON', async () => {
    mocks.anthropicCreate.mockResolvedValue(claude('not JSON'))
    const { evaluateStory } = await import('@/lib/storyEvaluator')
    await expect(evaluateStory('Story title', 'Story content')).resolves.toBeNull()
  })

  it('returns null when the response has no overall score', async () => {
    const { overall: _overall, ...incomplete } = validScores
    mocks.anthropicCreate.mockResolvedValue(claude(JSON.stringify(incomplete)))
    const { evaluateStory } = await import('@/lib/storyEvaluator')
    await expect(evaluateStory('Story title', 'Story content')).resolves.toBeNull()
  })

  it('falls back to Groq when Claude fails', async () => {
    mocks.anthropicCreate.mockRejectedValue(new Error('Claude unavailable'))
    mocks.groqCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validScores) } }],
    })
    const { evaluateStory } = await import('@/lib/storyEvaluator')
    await expect(evaluateStory('Story title', 'Story content', 'te')).resolves.toEqual(validScores)
    expect(mocks.groqCreate).toHaveBeenCalledTimes(1)
    expect(mocks.groqCreate.mock.calls[0][0].messages[1].content).toContain('Story title')
    expect(mocks.groqCreate.mock.calls[0][0].messages[0].content).toContain('Telugu')
  })

  it('returns null when Claude fails and Groq returns no content', async () => {
    mocks.anthropicCreate.mockRejectedValue(new Error('Claude unavailable'))
    mocks.groqCreate.mockResolvedValue({ choices: [{ message: { content: null } }] })
    const { evaluateStory } = await import('@/lib/storyEvaluator')
    await expect(evaluateStory('Story title', 'Story content')).resolves.toBeNull()
  })
})
