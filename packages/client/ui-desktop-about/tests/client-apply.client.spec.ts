import { afterEach, describe, expect, it } from 'vitest'
import { DESKTOP_ABOUT_GLOBAL } from '../src/index.ts'
import { desktopAboutFromGlobal } from '../src/client/index.ts'

interface DesktopAboutGlobal { __DSH_DESKTOP_ABOUT__?: unknown }

afterEach(() => { delete (globalThis as DesktopAboutGlobal).__DSH_DESKTOP_ABOUT__ })

describe('desktop About build metadata', () => {
  it('accepts only the Host-injected immutable fields', () => {
    ;(globalThis as Record<string, unknown>)[DESKTOP_ABOUT_GLOBAL] = {
      clientVersion: '0.1.0-rc.8', upstreamBaseTag: 'dsh-v0.1.1-rc.2',
    }
    expect(desktopAboutFromGlobal()).toEqual({ clientVersion: '0.1.0-rc.8', upstreamBaseTag: 'dsh-v0.1.1-rc.2' })
  })

  it('fails loudly without valid build metadata', () => {
    expect(() => desktopAboutFromGlobal()).toThrow('desktop about: build metadata is missing')
  })
})
