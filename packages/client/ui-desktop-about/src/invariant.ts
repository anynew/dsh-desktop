/** Package-owned invariant companion for the desktop About settings page. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-desktop-about'

/** Cordis companion plugin name. */
export const name = 'client-ui-desktop-about-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** UI lifecycle is covered by the settings slot and component tests. */
const install: InvariantInstaller = () => {}

/** Register the package-owned invariant companion. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
