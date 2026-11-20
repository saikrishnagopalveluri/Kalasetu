import { describe, it, expect } from 'vitest'
import { wordsToDigits } from '@/lib/numberWords'
import { parsePriceQuestion } from '@/lib/quickPrice'

// Spoken questions come back from Whisper with amounts as words
// ("fifteen hundred", "पंद्रह सौ", "పదిహేను వందలు"). They are turned into
// digits so the instant price answer works for speech too.

describe('wordsToDigits', () => {
  it.each([
    ['fifteen hundred rupees', '1500 rupees'],
    ['one thousand five hundred rupees', '1500 rupees'],
    ['two thousand and fifty', '2050'],
    ['twenty hours', '20 hours'],
    ['पंद्रह सौ रुपये', '1500 रुपये'],
    ['एक हज़ार पाँच सौ', '1500'],
    ['डेढ़ हजार रुपये', '1500 रुपये'],
    ['ढाई सौ', '250'],
    ['बीस घंटे', '20 घंटे'],
    ['पच्चीस', '25'],
    ['పదిహేను వందలు రూపాయలు', '1500 రూపాయలు'],
    ['పదిహేను ఒందలు', '1500'],
    ['పదిహేనువందలు', '1500'],
    ['రెండు వేల ఐదు వందలు', '2500'],
    ['ఇరవై గంటల', '20 గంటల'],
    ['ஆயிரத்து ஐநூறு ரூபாய்', '1500 ரூபாய்'],
    ['இருபது மணி', '20 மணி'],
    ['দেড় হাজার টাকা', '1500 টাকা'],
    ['ছয়শো টাকা', '600 টাকা'],
    ['দশ ঘণ্টা', '10 ঘণ্টা'],
    ['पंधराशे रुपये', '1500 रुपये'],
    ['वीस तास', '20 तास'],
    ['پندرہ سو روپے', '1500 روپے'],
    ['بیس گھنٹے', '20 گھنٹے'],
  ])('%s', (input, expected) => {
    expect(wordsToDigits(input)).toBe(expected)
  })

  it('leaves text without number words alone', () => {
    expect(wordsToDigits('Are there schemes for weavers?')).toBe('Are there schemes for weavers?')
    expect(wordsToDigits('1500 rupees, 20 hours')).toBe('1500 rupees, 20 hours')
  })
})

describe('spoken price questions', () => {
  it.each([
    ['Materials cost fifteen hundred rupees and it took twenty hours. What price?', 1500, 20],
    ['सामान पंद्रह सौ रुपये का है और बीस घंटे लगे। कितनी कीमत रखूं?', 1500, 20],
    // Whisper's real output for a Telugu question, misspelling included.
    ['నా చీరకు మిటీరీయల్ పదిహేను ఒందలు రూపాయలు ఇరవై గంటల పాని యంత ధార పేట్టాలి ?', 1500, 20],
    ['பொருட்களுக்கு ஆயிரத்து ஐநூறு ரூபாய், இருபது மணி நேர வேலை', 1500, 20],
    ['উপকরণে ছয়শো টাকা, দশ ঘণ্টা কাজ', 600, 10],
  ])('reads %s', (text, material, hours) => {
    expect(parsePriceQuestion(text)).toEqual({ materialCostInr: material, hoursOfWork: hours })
  })

  it('still leaves unclear questions to the agent', () => {
    // "one saree" adds a third number, so it is not a plain price question.
    expect(parsePriceQuestion('For one saree, fifteen hundred rupees and twenty hours')).toBeNull()
  })
})
