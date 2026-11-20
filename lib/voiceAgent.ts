// Saathi Voice Agent: the artisan speaks (or types) in their own language,
// Gemini listens to the audio directly, decides which KalaSetu tools to
// use through function calling, and answers in that language.
//
// Server-only. The tools read only the signed-in artisan's own data (or
// public scheme listings) and never write anything, so a misheard request
// can at worst show the wrong screen, never change or leak data.

import { callGenerateContent, responseParts, type GeminiResponse } from './gemini'
import { calculateFairPrice } from './fairPrice'
import { languageName } from './languages'
import { BRAND } from './brand'

export const MAX_AGENT_STEPS = 4
const AGENT_TIMEOUT_MS = 20_000

// A voice reply has to come back in seconds, so the agent tries the
// fastest reliable tool-calling model first (measured live: Flash-Lite
// answers in 2-6 s while the larger models were often overloaded), then
// the stronger models. Overridable from Vercel settings.
const DEFAULT_AGENT_MODELS = ['gemini-3.1-flash-lite', 'gemini-4-hydrogen', 'gemini-3.8-flash']
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

- Use your tools to actually help: price questions go through suggest_fair_price, scheme or support questions through find_schemes, "my products" through get_my_products, catalogue or sharing questions through get_my_profile, and when the artisan wants to do something in the app, open_screen.
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

async function agentStep(models: string[], body: Record<string, unknown>): Promise<{ json: GeminiResponse; model: string }> {
  let lastError: unknown
  for (const model of models) {
    try {
      return { json: (await callGenerateContent(model, body, AGENT_TIMEOUT_MS)) as GeminiResponse, model }
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

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const { json, model } = await agentStep(models, {
      systemInstruction: { parts: [{ text: systemPrompt(input.language) }] },
      contents,
      tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
      generationConfig: { maxOutputTokens: 4096 },
    })
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
