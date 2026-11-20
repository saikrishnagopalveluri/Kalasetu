import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { skyTimeFor } from '@/components/GondArt'

describe('skyTimeFor', () => {
  it.each([
    [0, 'night'], [4, 'night'], [5, 'morning'], [11, 'morning'],
    [12, 'afternoon'], [16, 'afternoon'], [17, 'evening'], [19, 'evening'],
    [20, 'night'], [23, 'night'],
  ])('hour %i is %s', (hour, sky) => {
    expect(skyTimeFor(hour)).toBe(sky)
  })

  it('returns a sky for every hour of the day', () => {
    for (let h = 0; h < 24; h++) {
      expect(['morning', 'afternoon', 'evening', 'night']).toContain(skyTimeFor(h))
    }
  })
})

describe('sky styles', () => {
  const css = readFileSync('app/globals.css', 'utf8')

  it.each(['morning', 'afternoon', 'evening'])('defines the %s sky with its own ink', (sky) => {
    const block = css.match(new RegExp(`\\.ks-sky-${sky} \\{([^}]*)\\}`))?.[1] ?? ''
    expect(block).toContain('--scene-ink:')
    expect(block).toContain('background-image:')
  })

  it.each(['app/page.tsx', 'components/LandingPage.tsx'])('%s follows the local time and uses scene ink', (file) => {
    const src = readFileSync(file, 'utf8')
    expect(src).toContain('useLocalHour()')
    expect(src).toContain("sky={hour === null ? 'night' : skyTimeFor(hour)}")
    expect(src).toContain("color: 'var(--scene-ink)'")
    // Reading the clock during render breaks hydration on the server-rendered demo.
    expect(src).not.toMatch(/new Date\(\)\.getHours\(\)/)
  })
})
