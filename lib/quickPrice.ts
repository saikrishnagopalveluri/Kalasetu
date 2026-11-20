// Instant answers for typed price questions. When a question plainly gives
// a rupee amount for materials and a number of hours, the fair-price
// calculator answers at once, with no AI call and no wait. Anything less
// clear (a wage, a per-hour rate, extra numbers, no rupee amount) returns
// null and goes to the voice agent as before.

import { calculateFairPrice } from './fairPrice'
import { getTranslations } from './translations'

export type QuickPriceResult = {
  heard: string
  reply: string
  actions: { type: 'price'; result: ReturnType<typeof calculateFairPrice> }[]
  toolsUsed: string[]
  model: string
}

// Zero of each Indian script's digits (plus Arabic-Indic and Ol Chiki,
// Meitei Mayek): Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil,
// Telugu, Kannada, Malayalam, Arabic-Indic, Extended Arabic-Indic.
const DIGIT_ZEROS = [0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66, 0x0660, 0x06f0, 0x1c50, 0xabf0]

function westernDigits(text: string): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    const zero = DIGIT_ZEROS.find((z) => code >= z && code <= z + 9)
    out += zero === undefined ? ch : String(code - zero)
  }
  return out
}

// Word stems, matched at the start of the word next to a number.
const HOUR_WORDS = ['hour', 'hrs', 'hr', 'घंट', 'घण्ट', 'तास', 'గంట', 'மணி', 'ঘণ্ট', 'ঘন্ট', 'گھنٹ', 'કલાક', 'ಗಂಟೆ', 'മണിക്കൂ', 'ਘੰਟ', 'ଘଣ୍ଟା']
const MONEY_WORDS = ['rupee', 'rs', 'inr', '₹', 'रुप', 'रूप', 'రూపా', 'ரூபா', 'টাকা', 'روپ', 'ರೂಪಾ', 'രൂപ', 'ਰੁਪ', 'ଟଙ୍କା', 'રૂપિ']
// A rate ("per hour", "an hour") means a wage is involved: leave it to the agent.
const RATE_WORDS = /\bper\b|\ban hour\b|\ba hour\b|\/\s*hr|प्रति|ప్రతి|ஒரு மணி|প্রতি|فی/i

const startsWithAny = (s: string, words: string[]) => words.some((w) => s.startsWith(w))
const endsWithAny = (s: string, words: string[]) => words.some((w) => s.endsWith(w))

export function parsePriceQuestion(text: string): { materialCostInr: number; hoursOfWork: number } | null {
  if (!text || RATE_WORDS.test(text)) return null
  const normal = westernDigits(text).toLowerCase().replace(/(\d),(?=\d)/g, '$1')
  // English stems only at the start of a word ("thread" has "hr" in it).
  const hourPattern = new RegExp(HOUR_WORDS.map((w) => (/^[a-z]/.test(w) ? `(?<![a-z])${w}` : w)).join('|'), 'g')
  const hourMentions = normal.match(hourPattern)?.length ?? 0
  if (hourMentions !== 1) return null

  const numbers = [...normal.matchAll(/\d+(?:\.\d+)?/g)]
  if (numbers.length !== 2) return null

  let hours: number | null = null
  let material: number | null = null
  for (const m of numbers) {
    const value = Number(m[0])
    const after = normal.slice(m.index + m[0].length, m.index + m[0].length + 20).trimStart()
    const before = normal.slice(Math.max(0, m.index - 12), m.index).replace(/[\s:.=-]+$/, '')
    if (startsWithAny(after, HOUR_WORDS)) hours = value
    else if (startsWithAny(after, MONEY_WORDS) || endsWithAny(before, ['₹', 'rs', 'inr'])) material = value
  }
  if (hours === null || material === null) return null
  if (!(hours > 0 && hours <= 2000) || !(material >= 0 && material <= 10_000_000)) return null
  return { materialCostInr: material, hoursOfWork: hours }
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`

export function quickPriceAnswer(text: string, language: string | undefined): QuickPriceResult | null {
  const parsed = parsePriceQuestion(text)
  if (!parsed) return null
  const result = calculateFairPrice(parsed)
  // The card labels are already translated into every language.
  const t = getTranslations(language ?? 'en')
  const reply = `${t['voice.fairPrice']}: ${rupees(result.fairPrice)}. ${t['voice.minimum']}: ${rupees(result.minimumPrice)}. ${t['voice.online']}: ${rupees(result.onlinePrice)}.`
  return { heard: text, reply, actions: [{ type: 'price', result }], toolsUsed: ['suggest_fair_price'], model: 'kalasetu/price-calculator' }
}
