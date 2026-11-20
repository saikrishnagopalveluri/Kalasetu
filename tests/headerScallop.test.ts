import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// The header holds pop-ups (the full-screen language picker). A CSS mask on
// the header clips everything inside it, pop-ups included, so the picker
// opened as an empty dimmed screen. The header uses the mask-free scallop.

describe('header scallop', () => {
  const layout = readFileSync('app/layout.tsx', 'utf8')
  const header = layout.match(/<header className="([^"]*)"/)?.[1] ?? ''

  it('does not mask the header', () => {
    expect(header.split(/\s+/)).not.toContain('ks-scallop')
    expect(header.split(/\s+/)).toContain('ks-scallop-edge')
  })

  it('draws the mask-free scallop without a mask', () => {
    const css = readFileSync('app/globals.css', 'utf8')
    const rule = css.match(/\.ks-scallop-edge::after \{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toContain('radial-gradient')
    expect(rule).not.toMatch(/mask/)
  })
})
