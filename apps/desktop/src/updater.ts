/** Signed release update lifecycle for packaged desktop applications. */

import type { BrowserWindow } from 'electron'
import { app, dialog } from 'electron'
import updater from 'electron-updater'
import { logDesktopError } from './logging.ts'
import { acceptsDesktopUpdate } from './update-policy.ts'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/** Minimal updater operations consumed by the desktop lifecycle. */
export interface DesktopUpdater {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowDowngrade: boolean
  isUpdateSupported(updateInfo: { version: string }): boolean | Promise<boolean>
  on(event: 'error', listener: (error: Error) => void): unknown
  on(event: 'update-downloaded', listener: () => void): unknown
  removeListener(event: 'error', listener: (error: Error) => void): unknown
  removeListener(event: 'update-downloaded', listener: () => void): unknown
  checkForUpdates(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

/** Dependencies used to present and schedule update actions. */
export interface DesktopUpdaterEnvironment {
  updater: DesktopUpdater
  readonly currentVersion: string
  showReady(window: BrowserWindow): Promise<boolean>
  setInterval(callback: () => void, milliseconds: number): ReturnType<typeof setInterval>
  clearInterval(timer: ReturnType<typeof setInterval>): void
}

const productionEnvironment: DesktopUpdaterEnvironment = {
  get updater() { return updater.autoUpdater },
  get currentVersion() { return app.getVersion() },
  async showReady(window) {
    const result = await dialog.showMessageBox(window, {
      type: 'info',
      title: 'DeepSeek Harness update ready',
      message: 'A verified update has been downloaded.',
      detail: 'Restart now to install it, or install automatically when the application exits.',
      buttons: ['Restart and install', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    })
    return result.response === 0
  },
  setInterval,
  clearInterval,
}

/**
 * Start update checks for a packaged application.
 * @param window - current application window used for update notifications.
 * @param environment - updater and scheduling implementation.
 * @returns disposer that stops periodic checks and removes listeners.
 */
export function installDesktopUpdater(
  window: BrowserWindow,
  environment: DesktopUpdaterEnvironment = productionEnvironment,
): () => void {
  const target = environment.updater
  let disposed = false
  let checking = false
  target.autoDownload = true
  target.autoInstallOnAppQuit = true
  target.allowDowngrade = false
  target.isUpdateSupported = updateInfo => acceptsDesktopUpdate(environment.currentVersion, updateInfo.version)
  const onError = (error: Error): void => { logDesktopError('desktop updater failed', error) }
  const onDownloaded = (): void => {
    void environment.showReady(window).then((restart) => {
      if (restart && !disposed) target.quitAndInstall(false, true)
    }).catch((error: unknown) => { logDesktopError('desktop update prompt failed', error) })
  }
  target.on('error', onError)
  target.on('update-downloaded', onDownloaded)
  const check = (): void => {
    if (disposed || checking) return
    checking = true
    void target.checkForUpdates()
      .catch((error: unknown) => { logDesktopError('desktop update check failed', error) })
      .finally(() => { checking = false })
  }
  check()
  const timer = environment.setInterval(check, CHECK_INTERVAL_MS)
  timer.unref()
  return () => {
    disposed = true
    environment.clearInterval(timer)
    target.removeListener('error', onError)
    target.removeListener('update-downloaded', onDownloaded)
  }
}
