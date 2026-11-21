// Phones (iOS Safari, and Chrome on Android) only let a page start sound
// during or right after a tap. Kala Mitra's spoken reply comes back several
// seconds after the artisan taps the mic or Send, by which time the phone
// silently refuses to play it. So during the tap we play a silent clip and a
// silent utterance, which unlocks sound for this page, and later replies play
// on that same, already unlocked, audio player.

// 44-byte WAV header with no samples: plays instantly and makes no sound.
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA='

let player: HTMLAudioElement | null = null

export function unlockedPlayer(): HTMLAudioElement {
  if (!player) player = new Audio()
  return player
}

// Call synchronously inside a tap handler, before any await.
export function unlockAudio(): void {
  try {
    const audio = unlockedPlayer()
    audio.src = SILENT_WAV
    void audio.play()?.catch(() => {})
  } catch {
    // A browser without audio support still gets the on-screen reply.
  }
  try {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined
    if (synth) {
      synth.resume?.()
      const silent = new SpeechSynthesisUtterance(' ')
      silent.volume = 0
      synth.speak(silent)
    }
  } catch {
    // Same: speech is a bonus, the text reply is always shown.
  }
}
