// Turns recorded audio into a small 16 kHz mono WAV, which Gemini reliably
// accepts from every browser. MediaRecorder output differs by browser
// (webm on Chrome, mp4 on Safari), so the voice page decodes whatever it
// recorded and re-encodes it here. Pure functions, so they are unit tested.

export const TARGET_SAMPLE_RATE = 16_000

// Mixes channels to mono and resamples by linear interpolation. Speech
// needs nothing more precise than this.
export function toMono16k(channels: Float32Array[], sampleRate: number, targetRate = TARGET_SAMPLE_RATE): Float32Array {
  if (channels.length === 0 || channels[0].length === 0) return new Float32Array(0)
  const length = channels[0].length
  const mono = new Float32Array(length)
  for (const channel of channels) {
    for (let i = 0; i < length; i++) mono[i] += (channel[i] ?? 0) / channels.length
  }
  if (sampleRate === targetRate) return mono
  const outLength = Math.max(1, Math.round((length * targetRate) / sampleRate))
  const out = new Float32Array(outLength)
  const ratio = (length - 1) / Math.max(1, outLength - 1)
  for (let i = 0; i < outLength; i++) {
    const pos = i * ratio
    const left = Math.floor(pos)
    const right = Math.min(left + 1, length - 1)
    out[i] = mono[left] + (mono[right] - mono[left]) * (pos - left)
  }
  return out
}

export function encodeWav(samples: Float32Array, sampleRate = TARGET_SAMPLE_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeAscii(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return bytes
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// Peak level of a recording, used to warn "I couldn't hear anything"
// before spending an AI call on silence.
export function peakLevel(samples: Float32Array): number {
  let peak = 0
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]))
  return peak
}
