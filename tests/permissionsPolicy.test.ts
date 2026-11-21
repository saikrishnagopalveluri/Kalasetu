import { describe, it, expect } from 'vitest'
import nextConfig from '../next.config'

// Kala Mitra records the artisan's voice with getUserMedia. The site sent
// "Permissions-Policy: microphone=()", which disables the microphone for every
// origin including our own, so Chrome and Edge refused it without ever showing
// a permission prompt (reported on a laptop, 21 Nov 2026).

async function policy(): Promise<string> {
  const rules = (await nextConfig.headers?.()) ?? []
  const header = rules.flatMap((r) => r.headers).find((h) => h.key.toLowerCase() === 'permissions-policy')
  return header?.value ?? ''
}

describe('Permissions-Policy header', () => {
  it('lets our own pages use the microphone, so the browser can ask the artisan', async () => {
    expect(await policy()).toMatch(/(^|,\s*)microphone=\(self\)/)
  })

  it('still blocks camera and location, which no page uses', async () => {
    const value = await policy()
    expect(value).toContain('camera=()')
    expect(value).toContain('geolocation=()')
  })
})
