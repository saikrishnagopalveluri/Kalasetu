import { describe, it, expect, vi, beforeEach } from 'vitest'

// Phones only let a page make sound shortly after a tap. Kala Mitra's reply
// arrives several seconds after the tap, so playing it then was silently
// blocked: read-aloud worked on a laptop but not on a phone (21 Nov 2026).
// The fix unlocks sound during the tap and reuses that same player later.

type FakeAudio = { src: string; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn>; muted: boolean }
let created: FakeAudio[]
let spoken: { text: string; volume: number }[]

beforeEach(() => {
  vi.resetModules()
  created = []
  spoken = []
  vi.stubGlobal('Audio', function FakeAudioCtor(this: FakeAudio) {
    this.src = ''
    this.muted = false
    this.play = vi.fn(() => Promise.resolve())
    this.pause = vi.fn()
    created.push(this)
  } as unknown as typeof Audio)
  vi.stubGlobal('SpeechSynthesisUtterance', function Utterance(this: { text: string; volume: number }, text: string) {
    this.text = text
    this.volume = 1
  } as unknown as typeof SpeechSynthesisUtterance)
  vi.stubGlobal('window', {
    speechSynthesis: {
      speak: vi.fn((u: { text: string; volume: number }) => spoken.push({ text: u.text, volume: u.volume })),
      resume: vi.fn(),
    },
  })
})

describe('unlockAudio', () => {
  it('plays a silent clip and a silent utterance inside the tap', async () => {
    const { unlockAudio } = await import('@/lib/audioUnlock')
    unlockAudio()
    expect(created).toHaveLength(1)
    expect(created[0].src).toMatch(/^data:audio\/wav;base64,/)
    expect(created[0].play).toHaveBeenCalledTimes(1)
    expect(spoken).toHaveLength(1)
    expect(spoken[0].volume).toBe(0)
  })

  it('reuses the unlocked player for the reply instead of making a new one', async () => {
    const { unlockAudio, unlockedPlayer } = await import('@/lib/audioUnlock')
    unlockAudio()
    unlockAudio()
    const player = unlockedPlayer()
    expect(created).toHaveLength(1)
    expect(player).toBe(created[0])
  })

  it('still gives a player when the page was never tapped', async () => {
    const { unlockedPlayer } = await import('@/lib/audioUnlock')
    expect(unlockedPlayer()).toBe(created[0])
    expect(created).toHaveLength(1)
  })

  it('does not throw when the browser blocks the silent clip', async () => {
    vi.stubGlobal('Audio', function Blocked(this: FakeAudio) {
      this.src = ''
      this.play = vi.fn(() => Promise.reject(new Error('NotAllowedError')))
      this.pause = vi.fn()
    } as unknown as typeof Audio)
    const { unlockAudio } = await import('@/lib/audioUnlock')
    expect(() => unlockAudio()).not.toThrow()
  })
})

describe('Kala Mitra voice page', () => {
  it('unlocks sound on the mic tap and the Send tap, and plays replies on the unlocked player', async () => {
    const { readFileSync } = await import('node:fs')
    const page = readFileSync('app/voice/page.tsx', 'utf8')
    const body = (name: string) => page.slice(page.indexOf(`function ${name}(`), page.indexOf(`function ${name}(`) + 400)
    expect(body('onMicClick')).toContain('unlockAudio()')
    expect(body('sendTyped')).toContain('unlockAudio()')
    expect(page).toContain('unlockedPlayer()')
    expect(page).not.toContain('new Audio(audioDataUrl)')
  })
})
