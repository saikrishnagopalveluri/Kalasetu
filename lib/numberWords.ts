// Spoken amounts as words, turned into digits: "fifteen hundred" → 1500,
// "पंद्रह सौ" → 1500, "పదిహేను వందలు" → 1500. Whisper writes numbers in
// Indian languages as words, so without this a spoken price question could
// never get the instant calculator answer.
//
// Only used to read price questions (lib/quickPrice.ts). The words the AI
// agent hears are never changed, so a word read as a number by mistake
// (Telugu "ఒక" is also "a") can at worst send a question to the agent.

const UNITS: Record<string, number> = {}
function add(values: Record<number, string>) {
  for (const [n, words] of Object.entries(values)) for (const w of words.split(' ')) UNITS[w] = Number(n)
}

// English
add({
  0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
  10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen',
  17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty', 30: 'thirty', 40: 'forty', 50: 'fifty',
  60: 'sixty', 70: 'seventy', 80: 'eighty', 90: 'ninety',
})
// Hindi (every number to 99 has its own word)
const HINDI = 'एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानवे बानवे तिरानवे चौरानवे पचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे'.split(' ')
HINDI.forEach((w, i) => { UNITS[w] = i + 1 })
add({ 5: 'पांच', 6: 'छः छे', 15: 'पन्द्रह', 1.5: 'डेढ़ डेढ', 2.5: 'ढाई' })
// Marathi
add({
  2: 'दोन', 5: 'पाच', 6: 'सहा', 9: 'नऊ', 10: 'दहा', 11: 'अकरा', 12: 'बारा', 13: 'तेरा', 14: 'चौदा', 15: 'पंधरा',
  16: 'सोळा', 17: 'सतरा', 18: 'अठरा', 19: 'एकोणीस', 20: 'वीस', 40: 'चाळीस', 50: 'पन्नास', 80: 'ऐंशी', 90: 'नव्वद',
})
// Telugu
add({
  1: 'ఒకటి ఒక', 2: 'రెండు', 3: 'మూడు', 4: 'నాలుగు', 5: 'ఐదు అయిదు', 6: 'ఆరు', 7: 'ఏడు', 8: 'ఎనిమిది', 9: 'తొమ్మిది',
  10: 'పది', 11: 'పదకొండు', 12: 'పన్నెండు', 13: 'పదమూడు', 14: 'పద్నాలుగు', 15: 'పదిహేను', 16: 'పదహారు',
  17: 'పదిహేడు', 18: 'పద్దెనిమిది', 19: 'పందొమ్మిది', 20: 'ఇరవై', 30: 'ముప్పై ముప్ఫై', 40: 'నలభై నలబై',
  50: 'యాభై యాబై', 60: 'అరవై', 70: 'డెబ్బై', 80: 'ఎనభై ఎనబై', 90: 'తొంభై తొంబై',
})
// Tamil (the hundreds have their own words)
add({
  1: 'ஒன்று ஒரு', 2: 'இரண்டு', 3: 'மூன்று', 4: 'நான்கு', 5: 'ஐந்து', 6: 'ஆறு', 7: 'ஏழு', 8: 'எட்டு', 9: 'ஒன்பது',
  10: 'பத்து', 11: 'பதினொன்று', 12: 'பன்னிரண்டு', 13: 'பதின்மூன்று', 14: 'பதினான்கு', 15: 'பதினைந்து',
  16: 'பதினாறு', 17: 'பதினேழு', 18: 'பதினெட்டு', 19: 'பத்தொன்பது', 20: 'இருபது', 30: 'முப்பது', 40: 'நாற்பது',
  50: 'ஐம்பது', 60: 'அறுபது', 70: 'எழுபது', 80: 'எண்பது', 90: 'தொண்ணூறு', 200: 'இருநூறு', 300: 'முந்நூறு',
  400: 'நானூறு', 500: 'ஐநூறு', 600: 'அறுநூறு', 700: 'எழுநூறு', 800: 'எண்ணூறு', 900: 'தொள்ளாயிரம்',
})
// Bengali
add({
  1: 'এক', 2: 'দুই', 3: 'তিন', 4: 'চার', 5: 'পাঁচ', 6: 'ছয়', 7: 'সাত', 8: 'আট', 9: 'নয়', 10: 'দশ', 11: 'এগারো',
  12: 'বারো', 13: 'তেরো', 14: 'চোদ্দ', 15: 'পনেরো', 16: 'ষোলো', 17: 'সতেরো', 18: 'আঠারো', 19: 'উনিশ',
  20: 'বিশ কুড়ি', 30: 'ত্রিশ তিরিশ', 40: 'চল্লিশ', 50: 'পঞ্চাশ', 60: 'ষাট', 70: 'সত্তর', 80: 'আশি', 90: 'নব্বই',
  1.5: 'দেড়', 2.5: 'আড়াই',
})
// Urdu
add({
  1: 'ایک', 2: 'دو', 3: 'تین', 4: 'چار', 5: 'پانچ', 6: 'چھ', 7: 'سات', 8: 'آٹھ', 9: 'نو', 10: 'دس', 11: 'گیارہ',
  12: 'بارہ', 13: 'تیرہ', 14: 'چودہ', 15: 'پندرہ', 16: 'سولہ', 17: 'سترہ', 18: 'اٹھارہ', 19: 'انیس', 20: 'بیس',
  30: 'تیس', 40: 'چالیس', 50: 'پچاس', 60: 'ساٹھ', 70: 'ستر', 80: 'اسی', 90: 'نوے', 1.5: 'ڈیڑھ', 2.5: 'ڈھائی',
})

// "सो" is how Whisper often spells "सौ" (heard live on 21 Nov 2026).
const HUNDRED = new Set(['hundred', 'सौ', 'सो', 'शंभर', 'వంద', 'వందలు', 'వందల', 'ఒంద', 'ఒందలు', 'ఒందల', 'నూరు', 'நூறு', 'শো', 'سو'])
const BIG: Record<string, number> = {}
for (const w of ['thousand', 'हज़ार', 'हजार', 'వెయ్యి', 'వేయి', 'వేలు', 'వేల', 'ஆயிரம்', 'ஆயிரத்து', 'হাজার', 'ہزار']) BIG[w] = 1000
for (const w of ['lakh', 'lac', 'lakhs', 'लाख', 'లక్ష', 'లక్షలు', 'లక్షల', 'இலட்சம்', 'லட்சம்', 'লাখ', 'لاکھ']) BIG[w] = 100_000
// Hundreds glued to the number before them: పదిహేనువందలు, पंधराशे, ছয়শো.
const GLUED_HUNDRED = ['వందలు', 'వందల', 'వంద', 'ఒందలు', 'ఒందల', 'सौ', 'शे', 'শো', 'শ']
const GLUED_BIG: [string, number][] = [['వేలు', 1000], ['వేల', 1000], ['हज़ार', 1000], ['हजार', 1000]]
const CONNECTORS = new Set(['and', 'और', 'ও', 'اور'])

type Part = { unit: number } | { mul: number } | { big: number }

function partsOf(word: string): Part[] | null {
  const w = word.toLowerCase()
  if (w in UNITS) return [{ unit: UNITS[w] }]
  if (HUNDRED.has(w)) return [{ mul: 100 }]
  if (w in BIG) return [{ big: BIG[w] }]
  if (/^[a-z]+-[a-z]+$/.test(w)) { // twenty-five
    const [a, b] = w.split('-')
    if (a in UNITS && b in UNITS) return [{ unit: UNITS[a] + UNITS[b] }]
  }
  for (const s of GLUED_HUNDRED) {
    const head = w.slice(0, -s.length)
    if (w.endsWith(s) && head in UNITS) return [{ unit: UNITS[head] }, { mul: 100 }]
  }
  for (const [s, v] of GLUED_BIG) {
    const head = w.slice(0, -s.length)
    if (w.endsWith(s) && head in UNITS) return [{ unit: UNITS[head] }, { big: v }]
  }
  return null
}

function valueOf(parts: Part[]): number {
  let total = 0
  let current = 0
  for (const p of parts) {
    if ('unit' in p) current += p.unit
    else if ('mul' in p) current = (current || 1) * p.mul
    else { total += (current || 1) * p.big; current = 0 }
  }
  return Math.round((total + current) * 100) / 100
}

const TRAILING = /[,.?!।؟،;:]+$/u

export function wordsToDigits(text: string): string {
  const pieces = text.split(/(\s+)/)
  const out: string[] = []
  let run: Part[] = []
  let runTail = ''
  let pendingGap = ''
  const flush = () => {
    if (run.length) { out.push(String(valueOf(run)) + runTail); run = []; runTail = '' }
  }
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]
    if (/^\s*$/.test(piece)) {
      // Between two number words the space is dropped (one amount); after
      // punctuation the amount has ended.
      if (run.length && !runTail) pendingGap = piece
      else { flush(); out.push(piece) }
      continue
    }
    const tail = piece.match(TRAILING)?.[0] ?? ''
    const core = piece.slice(0, piece.length - tail.length)
    const parts = runTail ? null : partsOf(core)
    // A connector ("and", "और") belongs to the amount only between two number words.
    const next = pieces[i + 2]
    const isConnector = run.length > 0 && !runTail && !tail && CONNECTORS.has(core.toLowerCase()) && next !== undefined && partsOf(next.replace(TRAILING, '')) !== null
    if (parts) {
      run.push(...parts)
      pendingGap = ''
      runTail = tail
    } else if (isConnector) {
      i++ // skip the space after the connector; the next word continues the amount
    } else {
      flush()
      if (pendingGap) { out.push(pendingGap); pendingGap = '' }
      out.push(piece)
    }
  }
  flush()
  if (pendingGap) out.push(pendingGap)
  return out.join('')
}
