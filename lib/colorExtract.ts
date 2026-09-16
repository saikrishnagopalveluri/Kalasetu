// Extracts a rough dominant-colour name from an uploaded image, client-side.
// Used to nudge the AI photoshoot generator toward the product's real colour
// since we don't have a true image-editing model available (see route.ts).

const COLOR_NAMES: { name: string; h: [number, number]; s: [number, number]; l: [number, number] }[] = [
  { name: 'white', h: [0, 360], s: [0, 15], l: [85, 100] },
  { name: 'black', h: [0, 360], s: [0, 100], l: [0, 12] },
  { name: 'gray', h: [0, 360], s: [0, 15], l: [12, 85] },
  { name: 'red', h: [345, 360], s: [30, 100], l: [20, 80] },
  { name: 'red', h: [0, 12], s: [30, 100], l: [20, 80] },
  { name: 'orange', h: [12, 40], s: [30, 100], l: [20, 80] },
  { name: 'golden yellow', h: [40, 55], s: [30, 100], l: [30, 85] },
  { name: 'yellow', h: [55, 65], s: [30, 100], l: [30, 85] },
  { name: 'olive green', h: [65, 90], s: [20, 100], l: [20, 70] },
  { name: 'green', h: [90, 150], s: [20, 100], l: [20, 80] },
  { name: 'teal', h: [150, 185], s: [20, 100], l: [20, 80] },
  { name: 'blue', h: [185, 240], s: [20, 100], l: [20, 80] },
  { name: 'indigo', h: [240, 265], s: [20, 100], l: [15, 70] },
  { name: 'purple', h: [265, 300], s: [20, 100], l: [20, 80] },
  { name: 'pink', h: [300, 345], s: [20, 100], l: [50, 90] },
  { name: 'maroon', h: [345, 360], s: [30, 100], l: [10, 35] },
]

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return [h, s * 100, l * 100]
}

function nameForHsl(h: number, s: number, l: number): string {
  for (const c of COLOR_NAMES) {
    if (h >= c.h[0] && h <= c.h[1] && s >= c.s[0] && s <= c.s[1] && l >= c.l[0] && l <= c.l[1]) {
      return c.name
    }
  }
  return 'multi-coloured'
}

export function extractDominantColor(imageDataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 48 // small sample size is plenty and keeps this fast
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(null); return }
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)

        let rSum = 0, gSum = 0, bSum = 0, count = 0
        for (let i = 0; i < data.length; i += 4) {
          const alpha = data[i + 3]
          if (alpha < 128) continue // skip transparent pixels
          rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2]
          count++
        }
        if (count === 0) { resolve(null); return }
        const [h, s, l] = rgbToHsl(rSum / count, gSum / count, bSum / count)
        resolve(nameForHsl(h, s, l))
      } catch {
        resolve(null) // e.g. a tainted canvas — fail quietly, colour hint is a nice-to-have
      }
    }
    img.onerror = () => resolve(null)
    img.src = imageDataUrl
  })
}
