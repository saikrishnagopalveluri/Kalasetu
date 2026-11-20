// A voice the phone already has for this language (for example Hindi or
// Telugu on most Android phones), or null. Voices load lazily in some
// browsers, so this is checked at speaking time, not at page load.
export function deviceVoiceFor(language: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const code = language.toLowerCase()
  const voices = window.speechSynthesis.getVoices()
  return voices.find((v) => v.lang.toLowerCase() === `${code}-in`)
    ?? voices.find((v) => v.lang.toLowerCase().split(/[-_]/)[0] === code)
    ?? null
}
