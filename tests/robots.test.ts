import { describe, it, expect } from 'vitest'
import robots from '@/app/robots'

// robots.ts is the single source of truth for which routes crawlers may
// index. Getting it wrong in either direction is a real regression: leaving
// /blog disallowed would undo the work that made it public and indexable;
// leaving a private, RequireAuth-gated route off the disallow list wastes
// crawl budget on login redirects instead of content.

describe('robots.ts: crawl rules', () => {
  const result = robots()

  it('allows the site by default', () => {
    expect(result.rules).toMatchObject({ userAgent: '*', allow: '/' })
  })

  it('does not disallow /blog (it is public and server-rendered)', () => {
    const disallow = Array.isArray(result.rules) ? [] : (result.rules.disallow ?? [])
    const list = Array.isArray(disallow) ? disallow : [disallow]
    expect(list).not.toContain('/blog')
  })

  it('disallows every route still gated behind RequireAuth', () => {
    const disallow = Array.isArray(result.rules) ? [] : (result.rules.disallow ?? [])
    const list = Array.isArray(disallow) ? disallow : [disallow]
    for (const route of ['/studio', '/products', '/design', '/calculator', '/content', '/profile', '/promote', '/coach', '/catalogue', '/opportunities', '/admin', '/api', '/pricing']) {
      expect(list, `expected ${route} to be disallowed`).toContain(route)
    }
  })

  it('points to a sitemap URL that is a well-formed https URL', () => {
    expect(result.sitemap).toMatch(/^https:\/\/.+\/sitemap\.xml$/)
  })
})
