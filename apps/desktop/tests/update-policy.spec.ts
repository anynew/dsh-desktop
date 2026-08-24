import { describe, expect, it } from 'vitest'
import { acceptsDesktopUpdate } from '../src/update-policy.ts'

describe('desktop update policy', () => {
  it('accepts only strictly newer release versions', () => {
    expect(acceptsDesktopUpdate('1.2.3', '1.2.4')).toBe(true)
    expect(acceptsDesktopUpdate('1.2.3', '1.3.0')).toBe(true)
    expect(acceptsDesktopUpdate('1.2.3', '2.0.0')).toBe(true)
    expect(acceptsDesktopUpdate('1.2.3', '1.2.3')).toBe(false)
    expect(acceptsDesktopUpdate('1.2.3', '1.2.2')).toBe(false)
  })

  it('promotes prereleases without allowing a stable release to regress', () => {
    expect(acceptsDesktopUpdate('1.0.0-rc.1', '1.0.0-rc.2')).toBe(true)
    expect(acceptsDesktopUpdate('1.0.0-rc.2', '1.0.0')).toBe(true)
    expect(acceptsDesktopUpdate('1.0.0', '1.0.1-rc.1')).toBe(true)
    expect(acceptsDesktopUpdate('1.0.0', '1.0.0-rc.9')).toBe(false)
  })

  it('rejects malformed versions', () => {
    expect(acceptsDesktopUpdate('development', '1.0.0')).toBe(false)
    expect(acceptsDesktopUpdate('1.0.0', 'latest')).toBe(false)
  })
})
