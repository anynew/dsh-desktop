/** Desktop-only About-page registration. */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { DESKTOP_ABOUT_GLOBAL, type DesktopAboutBuild } from '../index.ts'
import { AboutSection } from './AboutSection.tsx'
import type { AboutSectionInjected } from './AboutSection.tsx'
import { en, zh, type DesktopAboutKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.desktop-about': DesktopAboutKey }
}

const NS = 'settings.desktop-about'

/** Required Client services. */
export const inject = ['slots', 'locale']

/**
 * Read and validate the Host-provided desktop build fields at the browser boundary.
 * @returns validated immutable desktop build information.
 */
export function desktopAboutFromGlobal(): DesktopAboutBuild {
  const value = (globalThis as Record<string, unknown>)[DESKTOP_ABOUT_GLOBAL]
  if (typeof value !== 'object' || value === null) throw new Error('desktop about: build metadata is missing')
  const fields = value as Record<string, unknown>
  if (typeof fields.clientVersion !== 'string' || typeof fields.upstreamBaseTag !== 'string') {
    throw new Error('desktop about: build metadata is invalid')
  }
  return { clientVersion: fields.clientVersion, upstreamBaseTag: fields.upstreamBaseTag }
}

/** Register the desktop-only About section after Agent presets. */
export function apply(ctx: ClientContext): void {
  const about = desktopAboutFromGlobal()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-desktop-about: copy dictionaries')
  const t = ctx.locale.bind(NS) as AboutSectionInjected['t']
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'about', order: 30, label: () => t('nav'),
    inject: (): AboutSectionInjected => ({ about, t }),
  }, AboutSection))
}

export type { AboutSectionInjected } from './AboutSection.tsx'
export type { DesktopAboutKey } from './locales.ts'
