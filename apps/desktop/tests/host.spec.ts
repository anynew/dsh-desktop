import { describe, expect, it } from 'vitest'
import type { Profile } from '@deepseek-ai/dsh-app-boot'
import { desktopCarrierPatches } from '../src/host.ts'

describe('desktop profile adapter', () => {
  it('removes every listening-server row and releases Connection from webRuntime', () => {
    const profile = {
      name: 'desktop',
      dir: '/profile',
      patchPath: '/profile/cordis.patch.yml',
      patches: [],
      layers: [{
        packageName: '@deepseek-ai/dsh-web-app',
        packageDir: '/bundle',
        patchPath: '/bundle/cordis.patch.yml',
        patches: [],
      }],
    } satisfies Profile

    expect(desktopCarrierPatches(profile)).toEqual([
      { id: 'web-runtime', disabled: true },
      { id: 'web-startup', disabled: true },
      { id: 'webserver', disabled: true },
      { id: 'client-hmr', disabled: true },
      { id: 'directory-picker', disabled: true },
      { insert: [{ id: 'directory-picker-desktop', name: '@deepseek-ai/dsh-host-directory-picker-native' }] },
      { insert: [{ id: 'ui-directory-picker-desktop', name: '@deepseek-ai/dsh-client-ui-directory-picker-native' }] },
      { id: 'connection', inject: [], config: { trustedHosts: [] } },
      {
        id: 'agent-presets',
        config: {
          default: 'standard',
          roots: [{ path: expect.stringMatching(/apps\/cli\/config\/agent-presets\/$/), trust: 'system' }],
          includeUserRoot: true,
        },
      },
    ])
  })

  it('fails when a profile has no shared GUI roster', () => {
    const profile = {
      name: 'headless',
      dir: '/profile',
      patchPath: '/profile/cordis.patch.yml',
      patches: [],
      layers: [],
    } satisfies Profile

    let failure: unknown
    try {
      desktopCarrierPatches(profile)
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(Error)
    expect(String(failure)).toContain('does not include the shared GUI bundle')
  })
})
