import { describe, it, expect, afterEach, vi } from 'vitest'
import { deviceVoiceFor } from '@/lib/deviceVoice'

// Saathi speaks with the phone's own voice when it has one for the
// language (instant), and only asks Gemini for speech otherwise.

const voice = (lang: string) => ({ lang, name: lang }) as SpeechSynthesisVoice

function stubVoices(langs: string[]) {
  vi.stubGlobal('window', { speechSynthesis: { getVoices: () => langs.map(voice) } })
}

afterEach(() => vi.unstubAllGlobals())

describe('deviceVoiceFor', () => {
  it('prefers the Indian variant of the language', () => {
    stubVoices(['en-US', 'en-IN', 'hi-IN'])
    expect(deviceVoiceFor('en')?.lang).toBe('en-IN')
    expect(deviceVoiceFor('hi')?.lang).toBe('hi-IN')
  })

  it('accepts any regional variant, in either separator style', () => {
    stubVoices(['te_IN', 'ta-LK'])
    expect(deviceVoiceFor('te')?.lang).toBe('te_IN')
    expect(deviceVoiceFor('ta')?.lang).toBe('ta-LK')
  })

  it('returns null when the phone has no voice for the language, so Gemini speaks instead', () => {
    stubVoices(['en-IN', 'hi-IN'])
    expect(deviceVoiceFor('sat')).toBeNull()
    expect(deviceVoiceFor('kn')).toBeNull()
  })

  it('does not mistake one language code for another that starts the same way', () => {
    stubVoices(['mai-IN'])
    expect(deviceVoiceFor('ma')).toBeNull()
    expect(deviceVoiceFor('mai')?.lang).toBe('mai-IN')
  })

  it('returns null when speech is not supported at all', () => {
    vi.stubGlobal('window', {})
    expect(deviceVoiceFor('hi')).toBeNull()
  })
})
