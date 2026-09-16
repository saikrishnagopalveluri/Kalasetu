import sharp from 'sharp'
import { readFileSync } from 'fs'

const svg = readFileSync(new URL('./icon-source.svg', import.meta.url))

const targets = [
  { size: 192, out: 'public/icon-192.png' },
  { size: 512, out: 'public/icon-512.png' },
  { size: 180, out: 'public/apple-touch-icon.png' },
  { size: 32, out: 'public/favicon-32.png' },
]

for (const { size, out } of targets) {
  await sharp(svg).resize(size, size).png().toFile(out)
  console.log(`wrote ${out} (${size}x${size})`)
}
