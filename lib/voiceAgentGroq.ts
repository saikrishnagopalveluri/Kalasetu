// Groq fallback for the Saathi voice agent: used only when no Gemini model
// answered in time. Same instructions, facts and tools as the Gemini
// agent, so prices still come from the calculator and schemes from the
// approved list. Spoken questions are transcribed with Groq's Whisper
// first. Returns null when Groq is not configured.

import Groq, { toFile } from 'groq-sdk'
import {
  FUNCTION_DECLARATIONS, MAX_AGENT_STEPS, attachCards, parseAgentText, runTool, systemPrompt,
  type AgentAction, type AgentInput, type AgentResult, type Facts,
} from './voiceAgent'

export const GROQ_AGENT_MODEL = 'openai/gpt-oss-120b'
export const GROQ_TRANSCRIBE_MODEL = 'whisper-large-v3-turbo'

// Whisper language hints for languages it knows; others are auto-detected.
const WHISPER_LANGS = new Set(['en', 'hi', 'te', 'ta', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'ur', 'ne', 'as', 'sa', 'sd'])

type Message = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: unknown; tool_call_id?: string }

export async function runGroqAgent(input: AgentInput, facts: Facts, deadline: number): Promise<AgentResult | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null
  const client = new Groq({ apiKey })
  const timeLeft = () => Math.max(1_000, deadline - Date.now())

  let question = input.text?.trim() || ''
  let heard: string | null = question || null
  if (!question && input.audio) {
    const file = await toFile(Buffer.from(input.audio.data, 'base64'), 'speech.wav', { type: input.audio.mimeType })
    const transcript = await client.audio.transcriptions.create(
      { file, model: GROQ_TRANSCRIBE_MODEL, ...(input.language && WHISPER_LANGS.has(input.language) ? { language: input.language } : {}) },
      { timeout: timeLeft() },
    )
    question = transcript.text?.trim() ?? ''
    heard = question || null
  }
  if (!question) return null

  const messages: Message[] = [{ role: 'system', content: systemPrompt(input.language, facts.text) }]
  for (const turn of (input.history ?? []).slice(-8)) {
    if (typeof turn?.content === 'string' && turn.content.trim()) {
      messages.push({ role: turn.role === 'assistant' ? 'assistant' : 'user', content: turn.content.slice(0, 2000) })
    }
  }
  messages.push({ role: 'user', content: question.slice(0, 2000) })

  const tools = FUNCTION_DECLARATIONS.map((f) => ({ type: 'function' as const, function: f }))
  const actions: AgentAction[] = []
  const toolsUsed: string[] = []

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const res = await client.chat.completions.create(
      // The SDK's message and tool types are stricter than the shapes above.
      { model: GROQ_AGENT_MODEL, messages: messages as never, tools: tools as never, max_tokens: 1024 },
      { timeout: timeLeft() },
    )
    const msg = res.choices[0]?.message
    const calls = (msg?.tool_calls ?? []) as { id: string; function: { name: string; arguments: string } }[]
    if (calls.length === 0) {
      const text = msg?.content?.trim()
      if (!text) return null
      const parsed = parseAgentText(text)
      attachCards(parsed.cards, facts, actions)
      return { heard: parsed.heard ?? heard, reply: parsed.reply, actions, toolsUsed, model: `groq/${GROQ_AGENT_MODEL}` }
    }
    messages.push({ role: 'assistant', content: msg?.content ?? null, tool_calls: calls })
    for (const call of calls) {
      toolsUsed.push(call.function.name)
      let args: Record<string, unknown> = {}
      try { args = JSON.parse(call.function.arguments || '{}') } catch { /* malformed arguments: run with none */ }
      let response: Record<string, unknown>
      try {
        response = await runTool(call.function.name, args, input.data, actions)
      } catch (err) {
        console.error(`voiceAgent(groq): tool ${call.function.name} failed:`, err)
        response = { error: 'This tool is unavailable right now.' }
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(response) })
    }
  }
  return null
}
