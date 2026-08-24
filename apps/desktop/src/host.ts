/** Desktop Host startup over the existing profile composition without a listening socket. */

import { appendFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import {
  boot,
  healProfilesModuleFallback,
  loadProfile,
  type Profile,
} from '@deepseek-ai/dsh-app-boot'

const APP_NAME = 'dsh'
const PROFILE_ROOT_FILENAME = 'cordis.yml'
const PROFILE_ROOT_CONFIG = '[]\n'
const INSTALL_ANCHOR = fileURLToPath(new URL('../package.json', import.meta.url))
const SOURCE_PRESET_ROOT = fileURLToPath(new URL('../../cli/config/agent-presets/', import.meta.url))

/** Desktop profile boot inputs independent of Electron process lifecycle. */
export interface DesktopHostOptions {
  /** User profile name. */
  readonly profile: string
  /** Extra patches applied above the profile layers. */
  readonly overlays?: readonly PatchOptions[]
}

/**
 * Boot the shared GUI Host graph for Electron and remove Web-only carriers.
 * @param options - profile name and optional launcher overlays.
 * @returns the settled root context; its owner must dispose the root fiber.
 */
export async function bootDesktopHost(options: DesktopHostOptions): Promise<Context> {
  healProfilesModuleFallback(INSTALL_ANCHOR)
  const profile = loadProfile(APP_NAME, options.profile, INSTALL_ANCHOR)
  prepareRoot(profile)
  const patches = [
    ...profile.layers.flatMap(layer => layer.patches),
    ...profile.patches,
    ...options.overlays ?? [],
    ...desktopCarrierPatches(profile),
  ]
  const context = await boot(
    APP_NAME,
    join(profile.dir, PROFILE_ROOT_FILENAME),
    structuredClone(patches),
    (ctx) => {
      const profileRequire = createRequire(join(profile.dir, 'package.json'))
      const installRequire = createRequire(INSTALL_ANCHOR)
      ctx.loader.internal = {
        import: async (specifier: string, parentURL: string): Promise<unknown> => {
          const resolved = isAbsolute(specifier)
            ? pathToFileURL(specifier).href
            : specifier.startsWith('.')
              ? new URL(specifier, parentURL).href
              : pathToFileURL(resolveDesktopModule(profileRequire, installRequire, specifier)).href
          const loaded: unknown = await import(resolved)
          return loaded
        },
      } as never
    },
    pathToFileURL(INSTALL_ANCHOR).href,
  )
  const modules = context.get('clientModules')
  modules?.refresh()
  if (process.env.DSH_DESKTOP_SMOKE_FILE && modules !== undefined) {
    appendFileSync(process.env.DSH_DESKTOP_SMOKE_FILE, `DSH_DESKTOP_HOST_GRAPH ${JSON.stringify(modules.graph())}\n`)
  }
  return context
}

function resolveDesktopModule(
  profileRequire: NodeJS.Require,
  installRequire: NodeJS.Require,
  specifier: string,
): string {
  try {
    return profileRequire.resolve(specifier)
  } catch (profileError) {
    try {
      return installRequire.resolve(specifier)
    } catch {
      throw profileError
    }
  }
}

function prepareRoot(profile: Profile): void {
  writeFileSync(join(profile.dir, PROFILE_ROOT_FILENAME), PROFILE_ROOT_CONFIG)
}

/**
 * Replace Web-only rows while retaining the profile's shared Host and Client roster.
 * @param profile - loaded profile whose bundle list proves the GUI roster exists.
 * @returns highest-precedence desktop overrides.
 */
export function desktopCarrierPatches(profile: Profile): PatchOptions[] {
  const webLayer = profile.layers.find(layer => layer.packageName === '@deepseek-ai/dsh-web-app')
  if (webLayer === undefined) {
    throw new Error('desktop host: profile does not include the shared GUI bundle')
  }
  return [
    { id: 'web-runtime', disabled: true },
    { id: 'web-startup', disabled: true },
    { id: 'webserver', disabled: true },
    { id: 'client-hmr', disabled: true },
    { id: 'directory-picker', disabled: true },
    { insert: [{ id: 'directory-picker-desktop', name: '@deepseek-ai/dsh-host-directory-picker-native' }] },
    // The native picker has a separate client surface that occupies
    // ui-workspace's directory-flow slots. Keep it paired with the Host row:
    // without it WorkspaceBrowser intentionally hides its add-workspace action.
    { insert: [{ id: 'ui-directory-picker-desktop', name: '@deepseek-ai/dsh-client-ui-directory-picker-native' }] },
    { id: 'connection', inject: [], config: { trustedHosts: [] } },
    {
      id: 'agent-presets',
      config: {
        default: 'standard',
        roots: [{ path: desktopPresetRoot(), trust: 'system' }],
        includeUserRoot: true,
      },
    },
  ]
}

/** Resolve the app-owned preset directory in source and packaged layouts. */
function desktopPresetRoot(): string {
  if (process.defaultApp !== true && typeof process.resourcesPath === 'string') {
    return join(process.resourcesPath, 'config', 'agent-presets')
  }
  return SOURCE_PRESET_ROOT
}
