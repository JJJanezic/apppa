// @vitest-environment node
import { describe, expect, it } from 'vitest'

import nextConfig, { securityHeaders } from '../../next.config'

// BUG-3 aus QA PROJ-3: Sicherheitsheader laut .claude/rules/security.md für alle Pfade
describe('Sicherheitsheader', () => {
  it('gelten für alle Pfade', async () => {
    const rules = await nextConfig.headers!()
    expect(rules).toEqual([{ source: '/:path*', headers: securityHeaders }])
  })

  it.each([
    ['X-Frame-Options', 'DENY'],
    ['Content-Security-Policy', "frame-ancestors 'none'"],
    ['X-Content-Type-Options', 'nosniff'],
    ['Referrer-Policy', 'origin-when-cross-origin'],
    ['Strict-Transport-Security', 'max-age=63072000; includeSubDomains'],
  ])('%s: %s', (key, value) => {
    expect(securityHeaders).toContainEqual({ key, value })
  })
})
