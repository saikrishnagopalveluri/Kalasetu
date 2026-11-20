// Accuracy check for the Saathi voice agent, against the real Gemini API.
//
//   npx tsx scripts/evalVoiceAgent.mts
//
// Needs GEMINI_API_KEY (read from .env.local if present). Uses sample
// artisan data, never the database. Each case states what a correct answer
// must contain: the right tool or card, the right number, the right script.

import { readFileSync, existsSync } from 'node:fs'

if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY is not set')
  process.exit(1)
}

const { runVoiceAgent } = await import('../lib/voiceAgent')
type Result = Awaited<ReturnType<typeof runVoiceAgent>>

const data = {
  findSchemes: async () => [
    { title: 'PM Vishwakarma', type: 'scheme', deadline: null, url: 'https://pmvishwakarma.gov.in' },
    { title: 'Udyam Registration (MSME)', type: 'scheme', deadline: null, url: 'https://udyamregistration.gov.in' },
    { title: 'ITPO Trade Fairs', type: 'tradeshow', deadline: '2027-01-15', url: 'https://indiatradefair.com' },
  ],
  listProducts: async () => ({
    total: 2,
    items: [
      { name: 'Pochampally Ikat Saree', material: 'silk', hasListing: true },
      { name: 'Kalamkari Dupatta', material: 'cotton', hasListing: false },
    ],
  }),
  getProfile: async () => ({ name: 'Lakshmi', craft: 'Handloom weaving', state: 'Telangana', catalogueUrl: 'https://kalasetu.test/a/lakshmi' }),
}

const SCRIPTS: Record<string, RegExp> = {
  en: /[A-Za-z]/, hi: /[ऀ-ॿ]/, te: /[ఀ-౿]/, ta: /[஀-௿]/,
  bn: /[ঀ-৿]/, ur: /[؀-ۿ]/,
}

type Check = (r: Result) => string | null // null = pass, else why it failed
const price = (expected: number): Check => (r) => {
  const a = r.actions.find((x) => x.type === 'price')
  if (!a || a.type !== 'price') return 'no price calculation'
  return a.result.fairPrice === expected ? null : `price ${a.result.fairPrice}, expected ${expected}`
}
const card = (type: 'schemes' | 'catalogue'): Check => (r) => (r.actions.some((a) => a.type === type) ? null : `no ${type} card`)
const opens = (screen: string): Check => (r) => (r.actions.some((a) => a.type === 'open' && a.screen === screen) ? null : `did not open ${screen}`)
const mentions = (re: RegExp, what: string): Check => (r) => (re.test(r.reply) ? null : `reply does not mention ${what}`)
const noCards: Check = (r) => (r.actions.length === 0 ? null : `unexpected ${r.actions.map((a) => a.type).join(', ')}`)

const CASES: { lang: string; q: string; kind: string; check: Check }[] = [
  // Pricing: ₹1,500 + 20 h × ₹200 = ₹5,500 cost; 30% margin → ₹7,860
  { lang: 'en', kind: 'price', q: 'Materials cost 1500 rupees and it took 20 hours. What should I charge?', check: price(7860) },
  { lang: 'hi', kind: 'price', q: 'सामान 1500 रुपये का है और 20 घंटे लगे। कितनी कीमत रखूं?', check: price(7860) },
  { lang: 'te', kind: 'price', q: 'నా చీరకు మెటీరియల్ 1500 రూపాయలు, 20 గంటలు పని. ఎంత ధర పెట్టాలి?', check: price(7860) },
  { lang: 'ta', kind: 'price', q: 'பொருட்களுக்கு 1500 ரூபாய், 20 மணி நேர வேலை. என்ன விலை வைக்கலாம்?', check: price(7860) },
  // ₹600 + 10 h × ₹200 = ₹2,600 → ₹3,720
  { lang: 'en', kind: 'price', q: 'My pot used 600 rupees of clay and paint and took 10 hours. Fair price?', check: price(3720) },
  { lang: 'bn', kind: 'price', q: 'উপকরণে ৬০০ টাকা খরচ হয়েছে, ১০ ঘণ্টা কাজ। কত দাম রাখব?', check: price(3720) },
  // ₹2,000 + 30 h × ₹250 = ₹9,500 → ₹13,580
  { lang: 'en', kind: 'price', q: 'Materials 2000 rupees, 30 hours of work, and I want 250 rupees an hour. What price?', check: price(13580) },
  { lang: 'ur', kind: 'price', q: 'سامان 1500 روپے کا ہے اور 20 گھنٹے لگے۔ کتنی قیمت رکھوں؟', check: price(7860) },
  // Schemes
  { lang: 'en', kind: 'schemes', q: 'Are there any government schemes for weavers?', check: card('schemes') },
  { lang: 'hi', kind: 'schemes', q: 'बुनकरों के लिए कोई सरकारी योजना है?', check: card('schemes') },
  { lang: 'te', kind: 'schemes', q: 'నేత కార్మికులకు ఏవైనా ప్రభుత్వ పథకాలు ఉన్నాయా?', check: card('schemes') },
  { lang: 'ta', kind: 'schemes', q: 'நெசவாளர்களுக்கு அரசு திட்டங்கள் ஏதாவது உள்ளதா?', check: card('schemes') },
  { lang: 'en', kind: 'schemes', q: 'Can I get a loan for my craft business?', check: card('schemes') },
  { lang: 'en', kind: 'schemes', q: 'Are there any trade fairs I can join?', check: card('schemes') },
  // Catalogue link
  { lang: 'en', kind: 'catalogue', q: 'Give me my catalogue link to send on WhatsApp.', check: card('catalogue') },
  { lang: 'hi', kind: 'catalogue', q: 'मेरा कैटलॉग लिंक दो, WhatsApp पर भेजना है।', check: card('catalogue') },
  { lang: 'te', kind: 'catalogue', q: 'నా కేటలాగ్ లింక్ ఇవ్వండి', check: card('catalogue') },
  // Products
  { lang: 'en', kind: 'products', q: 'Which of my products still need a description?', check: mentions(/kalamkari|dupatta/i, 'the Kalamkari dupatta') },
  { lang: 'en', kind: 'products', q: 'How many products do I have?', check: mentions(/\b2\b|two/i, 'two products') },
  { lang: 'te', kind: 'products', q: 'నా ఉత్పత్తుల్లో దేనికి ఇంకా వివరణ రాయలేదు?', check: mentions(/దుపట్టా|కలంకారీ|Kalamkari|Dupatta/i, 'the Kalamkari dupatta') },
  // Opening screens
  { lang: 'en', kind: 'open', q: 'I want to take a nice photo of my saree.', check: opens('photoshoot') },
  { lang: 'hi', kind: 'open', q: 'मुझे अपने उत्पाद की फोटो खींचनी है', check: opens('photoshoot') },
  { lang: 'en', kind: 'open', q: 'Open the pricing calculator.', check: opens('calculator') },
  { lang: 'en', kind: 'open', q: 'Help me write an Instagram caption for my dupatta.', check: opens('listing') },
  { lang: 'te', kind: 'open', q: 'నా కేటలాగ్ తయారు చేయాలి', check: (r) => (r.actions.some((a) => (a.type === 'open' && a.screen === 'catalogue') || a.type === 'catalogue') ? null : 'did not open the catalogue') },
  { lang: 'en', kind: 'open', q: 'Show me the lessons to learn marketing.', check: opens('learn') },
  // Off-topic: polite redirect, no tools
  { lang: 'en', kind: 'offtopic', q: 'Who won the cricket match yesterday?', check: noCards },
  { lang: 'hi', kind: 'offtopic', q: 'मुझे एक चुटकुला सुनाओ', check: noCards },
  { lang: 'en', kind: 'offtopic', q: 'What is the capital of France?', check: noCards },
  // Never invents a price without numbers
  { lang: 'en', kind: 'no-guess', q: 'How much should I charge for a saree?', check: (r) => (/\d{3,}/.test(r.reply.replace(/,/g, '')) && !r.actions.some((a) => a.type === 'price') ? 'gave a price without calculating' : null) },
]

// A short pause between questions, like one artisan using the app, so
// the free tier's per-minute limit measures as little as possible.
const GAP_MS = Number(process.env.EVAL_GAP_MS ?? 2000)

const results: { kind: string; ok: boolean; ms: number }[] = []
for (const [i, c] of CASES.entries()) {
  const t = Date.now()
  let line: string
  try {
    const r = await runVoiceAgent({ text: c.q, language: c.lang, data })
    const why = c.check(r) ?? (SCRIPTS[c.lang].test(r.reply) ? null : `reply not in ${c.lang} script`)
    results.push({ kind: c.kind, ok: !why, ms: Date.now() - t })
    line = `${why ? 'FAIL' : 'pass'} ${String(Date.now() - t).padStart(6)}ms [${c.lang}] ${c.kind.padEnd(9)} ${why ?? ''}`
  } catch (e) {
    results.push({ kind: c.kind, ok: false, ms: Date.now() - t })
    line = `FAIL ${String(Date.now() - t).padStart(6)}ms [${c.lang}] ${c.kind.padEnd(9)} error: ${(e as Error).message.slice(0, 80)}`
  }
  console.log(`${String(i + 1).padStart(2)}. ${line}`)
  await new Promise((r) => setTimeout(r, GAP_MS))
}

const passed = results.filter((r) => r.ok).length
const times = results.map((r) => r.ms).sort((a, b) => a - b)
console.log(`\nAccuracy: ${passed}/${results.length} (${Math.round((passed / results.length) * 100)}%)`)
console.log(`Speed: median ${times[Math.floor(times.length / 2)]} ms, 90th percentile ${times[Math.floor(times.length * 0.9)]} ms`)
for (const kind of [...new Set(results.map((r) => r.kind))]) {
  const k = results.filter((r) => r.kind === kind)
  console.log(`  ${kind.padEnd(9)} ${k.filter((r) => r.ok).length}/${k.length}`)
}
