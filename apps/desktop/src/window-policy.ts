/** BrowserWindow security policy shared by startup and process-free tests. */

import { shell, type BrowserWindow, type HandlerDetails } from 'electron'
import { DESKTOP_APP_ORIGIN } from './ipc-main.ts'
import { installDesktopSessionPolicy } from './session-policy.ts'

/** Exact renderer URL loaded by the desktop shell. */
export const DESKTOP_APP_URL = `${DESKTOP_APP_ORIGIN}/`

/**
 * Immutable webPreferences required by the privileged preload design.
 * @param preload - absolute sandboxed preload path.
 * @param development - whether renderer developer tools are permitted.
 * @returns hardened Electron renderer preferences.
 */
export function desktopWebPreferences(preload: string, development: boolean): Electron.WebPreferences {
  return {
    preload,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: true,
    devTools: development,
  }
}

/** Allow in-window navigation only within the application origin. */
export function isAllowedNavigation(target: string): boolean {
  try {
    const url = new URL(target)
    return `${url.protocol}//${url.host}` === DESKTOP_APP_ORIGIN
      && url.username === '' && url.password === '' && url.port === ''
  } catch {
    return false
  }
}

/** Allow only explicit HTTPS destinations to leave the application in the system browser. */
export function isAllowedExternalUrl(target: string): boolean {
  try {
    const url = new URL(target)
    return url.protocol === 'https:' && url.username === '' && url.password === ''
  } catch {
    return false
  }
}

/** Install denial-by-default navigation, popup, permission, and download policies. */
export function installWindowPolicy(window: BrowserWindow): void {
  const contents = window.webContents
  contents.setWindowOpenHandler((details: HandlerDetails) => {
    if (isAllowedExternalUrl(details.url)) void shell.openExternal(details.url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, target) => {
    if (!isAllowedNavigation(target)) event.preventDefault()
  })
  installDesktopSessionPolicy(contents.session)
  contents.session.setPermissionRequestHandler((_webContents, _permission, callback) => { callback(false) })
  contents.session.setPermissionCheckHandler(() => false)
  contents.session.on('will-download', (event) => { event.preventDefault() })
}
