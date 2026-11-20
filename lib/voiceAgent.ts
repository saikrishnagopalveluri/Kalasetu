// Saathi Voice Agent: the artisan speaks (or types) in their own language,
// Gemini listens to the audio directly, decides which KalaSetu tools to
// use through function calling, and answers in that language.
//
// Server-only. The tools read only the signed-in artisan's own data (or
// public scheme listings) and never write anything, so a misheard request
// can at worst show the wrong screen, never change or leak data.

import { callGenerateContent, geminiGrounded, responseParts, type GeminiResponse, type GroundedSource } from './gemini'
import { calculateFairPrice } from './fairPrice'
import { languageName } from './languages'
import { BRAND } from './brand'

export const MAX_AGENT_STEPS = 4
// Per attempt. Healthy calls finish in 2-10 s (measured live); a call
// past this has stalled, and a retry is faster than waiting it out.
export const AGENT_ATTEMPT_TIMEOUT_MS = 12_000
// For the whole answer, so it either finishes or fails cleanly well
// before the route's 60 s platform limit cuts it off mid-reply.
export const AGENT_TOTAL_BUDGET_MS = 45_000

// A voice reply has to come back in seconds, so the agent uses the fast
// "lite" models, which were the ones still answering tool calls when the
// larger models were overloaded (measured live on 20 Nov 2026: 3.5
// Flash-Lite answered 3 of 3, 3.8 Flash and Flash latest mostly 503).
// Overridable from Vercel settings.
const DEFAULT_AGENT_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-4-hydrogen']
export function agentModels(): string[] {
  const list = (process.env.GEMINI_AGENT_MODEL ?? '').split(',').map((m) => m.trim()).filter(Boolean)
  return list.length > 0 ? list : DEFAULT_AGENT_MODELS
}

// Screens the agent may open. A fixed map, so the model can only ever
// send the artisan to a real page of the app.
export const APP_SCREENS = {
  photoshoot: { path: '/studio', label: 'AI Photoshoot' },
  listing: { path: '/content', label: 'Listing & captions' },
  promote: { path: '/promote', label: 'Promote' },
  design: { path: '/design', label: 'Design Studio' },
  calculator: { path: '/calculator', label: 'Pricing Calculator' },
  products: { path: '/products', label: 'My Products' },
  catalogue: { path: '/catalogue', label: 'My Catalogue' },
  schemes: { path: '/opportunities', label: 'Schemes & Opportunities' },
  learn: { path: '/upskill', label: 'UpSkill Academy' },
  community: { path: '/community', label: 'Community stories' },
  wallet: { path: '/wallet', label: 'KalaWallet' },
} as const
export type ScreenId = keyof typeof APP_SCREENS

export type AgentAction =
  | { type: 'open'; screen: ScreenId; path: string; label: string }
  | { type: 'price'; result: ReturnType<typeof calculateFairPrice> }
  | { type: 'schemes'; items: SchemeItem[] }
  | { type: 'catalogue'; url: string | null }
  | { type: 'web'; answer: string; sources: GroundedSource[] }

export type SchemeItem = { title: string; type: string; deadline: string | null; url: string }

// Data access the tools need, injected so the agent is testable without a
// database and so the route decides which client (and which user) is used.
export type AgentDataSource = {
  findSchemes(keyword: string | null, type: string | null): Promise<SchemeItem[]>
  listProducts(): Promise<{ total: number; items: { name: string; material: string | null; hasListing: boolean }[] }>
  getProfile(): Promise<{ name: string | null; craft: string | null; state: string | null; catalogueUrl: string | null } | null>
}

export type AgentTurn = { role: 'user' | 'assistant'; content: string }

export type AgentInput = {
  audio?: { mimeType: string; data: string } | null
  text?: string | null
  history?: AgentTurn[]
  language?: string
  data: AgentDataSource
}

export type AgentResult = {
  heard: string | null
  reply: string
  actions: AgentAction[]
  toolsUsed: string[]
  model: string
}

const FUNCTION_DECLARATIONS = [
  {
    name: 'suggest_fair_price',
    description: 'Calculate a fair selling price for a handmade product from material cost and hours of work. Always use this for any price question instead of guessing a number.',
    parameters: {
      type: 'object',
      properties: {
        material_cost_inr: { type: 'number', description: 'Cost of raw materials in rupees' },
        hours_of_work: { type: 'number', description: 'Total hours of hand work' },
        hourly_wage_inr: { type: 'number', description: 'Optional. What the artisan wants to earn per hour. Default 200.' },
        other_costs_inr: { type: 'number', description: 'Optional. Packaging, transport, electricity and similar costs in rupees.' },
      },
      required: ['material_cost_inr', 'hours_of_work'],
    },
  },
  {
    name: 'find_schemes',
    description: 'Find government schemes, competitions and trade shows for artisans that are open now. Use for any question about subsidies, loans, grants, support, exhibitions or schemes.',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Optional single word to filter by, in English, e.g. loan, handloom, exhibition' },
        type: { type: 'string', enum: ['scheme', 'competition', 'tradeshow'], description: 'Optional kind of opportunity' },
      },
    },
  },
  {
    name: 'search_schemes_online',
    description: 'Search the web live with Google Search for current government schemes, subsidies, loans, exhibitions or deadlines for artisans. Use it when the artisan asks about something new or recent, or when find_schemes returned nothing useful.',
    parameters: {
      type: 'object',
      properties: { question: { type: 'string', description: 'What to look up, in English, including the craft and state if known' } },
      required: ['question'],
    },
  },
  {
    name: 'get_my_products',
    description: "List the artisan's own products and whether each already has a written listing.",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_my_profile',
    description: "Get the artisan's name, craft, state and public catalogue link (to share on WhatsApp).",
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'open_screen',
    description: 'Open a screen of the app for the artisan, e.g. to take a product photo (photoshoot), write a listing or caption (listing), or see their catalogue.',
    parameters: {
      type: 'object',
      properties: { screen: { type: 'string', enum: Object.keys(APP_SCREENS) } },
      required: ['screen'],
    },
  },
]

function systemPrompt(language: string | undefined): string {
  const lang = languageName(language)
  return `You are ${BRAND.name} Saathi, a voice assistant for traditional Indian artisans. Artisans talk to you, often in a regional language and often with little reading or typing, so your reply will be read aloud.

- Use your tools to actually help: price questions go through suggest_fair_price, scheme or support questions through find_schemes first (then search_schemes_online for anything new, recent or missing), "my products" through get_my_products, catalogue or sharing questions through get_my_profile, and when the artisan wants to do something in the app, open_screen.
- Call the tool in this same turn. Never say you will look something up, check, or find something later: either call the tool now or answer.
- Never invent prices, schemes, deadlines or links. Only use numbers and names the tools return. If a tool returns nothing, say so honestly.
- Speak plainly, like a friendly person who knows crafts. 2 to 4 short sentences. No markdown, no lists, no symbols, no emojis, because this is spoken aloud. Say amounts as rupees.
- Only help with crafts, the artisan's business, this app and schemes. For anything else, say briefly that you help with their craft business.
- If someone sounds in crisis or mentions self-harm, gently share the KIRAN helpline 1800-599-0019 (24/7, free) and encourage them to call.
${lang ? `- Always reply in ${lang}, whatever language the artisan uses.` : "- Reply in the same language the artisan speaks."}

Format your final answer exactly as two lines:
HEARD: <what the artisan said, written in their language and script>
REPLY: <your spoken reply>`
}

type Part = Record<string, unknown>
type Content = { role: 'user' | 'model'; parts: Part[] }

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function runTool(name: string, args: Record<string, unknown>, data: AgentDataSource, actions: AgentAction[]): Promise<Record<string, unknown>> {
  switch (name) {
    case 'suggest_fair_price': {
      const result = calculateFairPrice({
        materialCostInr: Number(args.material_cost_inr),
        hoursOfWork: Number(args.hours_of_work),
        hourlyWageInr: args.hourly_wage_inr === undefined ? undefined : Number(args.hourly_wage_inr),
        otherCostsInr: args.other_costs_inr === undefined ? undefined : Number(args.other_costs_inr),
      })
      actions.push({ type: 'price', result })
      return { ...result, note: 'fairPrice is the price to quote. minimumPrice only covers costs and wages. onlinePrice covers marketplace fees.' }
    }
    case 'find_schemes': {
      const keyword = str(args.keyword)
      const type = str(args.type)
      const items = await data.findSchemes(keyword, type && ['scheme', 'competition', 'tradeshow'].includes(type) ? type : null)
      if (items.length > 0) actions.push({ type: 'schemes', items })
      return { count: items.length, items }
    }
    case 'search_schemes_online': {
      const question = str(args.question)
      if (!question) return { error: 'A question is required' }
      try {
        const { text, sources } = await geminiGrounded({
          prompt: `${question.slice(0, 400)}\n\nAnswer for an Indian artisan in 3 to 5 plain sentences: name each scheme, who can apply and how. Only state what the sources say.`,
          timeoutMs: 20_000,
        })
        actions.push({ type: 'web', answer: text, sources })
        return { answer: text, sources }
      } catch (err) {
        console.error('voiceAgent: live search unavailable:', err instanceof Error ? err.message : err)
        return { error: 'Live web search is not available right now. Answer from find_schemes results only.' }
      }
    }
    case 'get_my_products':
      return data.listProducts()
    case 'get_my_profile': {
      const profile = await data.getProfile()
      if (profile) actions.push({ type: 'catalogue', url: profile.catalogueUrl })
      return profile ?? { error: 'No profile found' }
    }
    case 'open_screen': {
      const screen = str(args.screen)
      if (!screen || !Object.hasOwn(APP_SCREENS, screen)) return { error: 'Unknown screen' }
      const target = APP_SCREENS[screen as ScreenId]
      actions.push({ type: 'open', screen: screen as ScreenId, path: target.path, label: target.label })
      return { opened: target.label }
    }
    default:
      return { error: `Unknown tool ${name}` }
  }
}

export function parseAgentText(text: string): { heard: string | null; reply: string } {
  const cleaned = text.replace(/\*\*/g, '').trim()
  const heard = cleaned.match(/^\s*HEARD:\s*(.*)$/im)?.[1]?.trim() || null
  const replyIdx = cleaned.search(/^\s*REPLY:/im)
  const reply = replyIdx === -1
    ? cleaned.replace(/^\s*HEARD:.*$/im, '').trim()
    : cleaned.slice(replyIdx).replace(/^\s*REPLY:\s*/i, '').trim()
  return { heard, reply: reply.replace(/\s*—\s*/g, ', ') }
}

// Gemini models are sometimes briefly overloaded (503) or stall. Each step
// gives the first model a second chance, since these spikes pass in
// seconds, before moving on to the next model. Every attempt is capped by
// what is left of the overall budget.
export function attemptOrder(models: string[]): string[] {
  return models.length > 0 ? [models[0], ...models] : []
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError' || /aborted due to timeout/i.test(err.message))
}

async function agentStep(models: string[], body: Record<string, unknown>, deadline: number): Promise<{ json: GeminiResponse; model: string }> {
  let lastError: unknown = new Error('voiceAgent: no model available')
  const order = attemptOrder(models)
  for (let i = 0; i < order.length; i++) {
    const model = order[i]
    // The retry is for a quick "busy" answer. A model that just stalled
    // for the full attempt time is unlikely to recover on the spot.
    if (i === 1 && isTimeout(lastError)) continue
    const remaining = deadline - Date.now()
    if (remaining < 1_000) break
    try {
      const json = (await callGenerateContent(model, body, Math.min(AGENT_ATTEMPT_TIMEOUT_MS, remaining))) as GeminiResponse
      // An empty reply (no text and no tool call) is a failed attempt too:
      // models occasionally spend their whole output on thinking or emit a
      // malformed tool call. Move on rather than failing the answer.
      const parts = responseParts(json)
      const usable = parts.some((p) => (p.functionCall && typeof p.functionCall === 'object') || (typeof p.text === 'string' && p.text.trim() && !p.thought))
      if (!usable) {
        const reason = (json.candidates?.[0] as { finishReason?: string } | undefined)?.finishReason ?? 'unknown'
        throw new Error(`voiceAgent: ${model} returned an empty reply (finish: ${reason})`)
      }
      return { json, model }
    } catch (err) {
      lastError = err
      console.error(`voiceAgent: ${model} failed:`, err instanceof Error ? err.message : err)
    }
  }
  throw lastError
}

export async function runVoiceAgent(input: AgentInput): Promise<AgentResult> {
  const contents: Content[] = []
  for (const turn of (input.history ?? []).slice(-8)) {
    const text = str(turn?.content)
    if (!text) continue
    contents.push({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: text.slice(0, 2000) }] })
  }
  const parts: Part[] = []
  if (input.audio) parts.push({ inlineData: { mimeType: input.audio.mimeType, data: input.audio.data } })
  const typed = str(input.text)
  parts.push({ text: typed ? typed.slice(0, 2000) : 'The artisan is speaking in the audio above. Listen and help.' })
  contents.push({ role: 'user', parts })

  const actions: AgentAction[] = []
  const toolsUsed: string[] = []
  let models = agentModels()
  const deadline = Date.now() + AGENT_TOTAL_BUDGET_MS

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const { json, model } = await agentStep(models, {
      systemInstruction: { parts: [{ text: systemPrompt(input.language) }] },
      contents,
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      generationConfig: { maxOutputTokens: 4096 },
    }, deadline)
    // Stay on the model that answered for the rest of this conversation
    // turn: its thought signatures only make sense to the same model.
    models = [model]
    const modelParts = responseParts(json)
    const calls = modelParts.filter((p) => p.functionCall && typeof p.functionCall === 'object')

    if (calls.length === 0) {
      const text = modelParts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text as string).join('').trim()
      if (!text) throw new Error(`voiceAgent: ${model} returned no answer`)
      const { heard, reply } = parseAgentText(text)
      return { heard: heard ?? typed, reply, actions, toolsUsed, model }
    }

    // Echo the model's turn back unchanged (thought signatures included),
    // then answer every function call it made.
    contents.push({ role: 'model', parts: modelParts })
    const responses: Part[] = []
    for (const part of calls) {
      const call = part.functionCall as { name?: string; args?: Record<string, unknown>; id?: string }
      const name = String(call.name ?? '')
      toolsUsed.push(name)
      let response: Record<string, unknown>
      try {
        response = await runTool(name, call.args ?? {}, input.data, actions)
      } catch (err) {
        console.error(`voiceAgent: tool ${name} failed:`, err)
        response = { error: 'This tool is unavailable right now.' }
      }
      responses.push({ functionResponse: { name, response, ...(call.id ? { id: call.id } : {}) } })
    }
    contents.push({ role: 'user', parts: responses })
  }
  throw new Error('voiceAgent: too many tool steps without an answer')
}
