/** Stable desktop application identity used before Electron computes userData paths. */

/** Production application name displayed by the operating system. */
export const DESKTOP_PRODUCT_NAME = 'DeepSeek Harness'

/** Electron app-model identifier shared with the package identifier. */
export const DESKTOP_APP_ID = 'ai.deepseek.harness'

/** Configure stable OS integration identifiers before the application becomes ready. */
export function installDesktopIdentity(app: Electron.App, platform: NodeJS.Platform): void {
  app.setName(DESKTOP_PRODUCT_NAME)
  if (platform === 'win32') app.setAppUserModelId(DESKTOP_APP_ID)
}
