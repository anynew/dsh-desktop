/** Electron process lifecycle for the DeepSeek Harness desktop application. */

import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, crashReporter, ipcMain, Menu, protocol } from 'electron'
import { installDesktopIdentity } from './app-identity.ts'
import { desktopMenuTemplate } from './application-menu.ts'
import { rejectInvalidCertificate } from './certificate-policy.ts'
import { installDesktopCommandLinePolicy } from './command-line-policy.ts'
import { installDesktopCrashReporting } from './crash-reporting.ts'
import { bootDesktopHost } from './host.ts'
import { DesktopIpcHost } from './ipc-main.ts'
import { installDesktopLogging, logDesktopError } from './logging.ts'
import { hidesMainWindowOnClose, quitsAfterLastWindow } from './platform-lifecycle.ts'
import { createDesktopProtocolHandler } from './protocol.ts'
import { RendererRecoveryPolicy } from './recovery.ts'
import { DesktopShutdown } from './shutdown.ts'
import { handlePreventUnload } from './unload-policy.ts'
import { installDesktopUpdater } from './updater.ts'
import { DESKTOP_APP_URL, desktopWebPreferences, installWindowPolicy } from './window-policy.ts'
import { DesktopWindowStateStore } from './window-state.ts'

function formatStartupError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const aggregate = (error as Error & { errors?: unknown }).errors
  const children = Array.isArray(aggregate) ? aggregate.map(formatStartupError).join('\n') : ''
  const cause = error.cause === undefined ? '' : `\n${formatStartupError(error.cause)}`
  return `${error.stack ?? error.message}${cause}${children === '' ? '' : `\n${children}`}`
}

if (process.env.DSH_DESKTOP_SMOKE_FILE) {
  writeFileSync(process.env.DSH_DESKTOP_SMOKE_FILE, 'DSH_DESKTOP_SMOKE starting\n')
}

installDesktopIdentity(app, process.platform)
installDesktopCommandLinePolicy(app.commandLine)
installDesktopCrashReporting(crashReporter)
installDesktopLogging()

protocol.registerSchemesAsPrivileged([{
  scheme: 'dsh-app',
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: false,
    stream: true,
  },
}])

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | undefined
  let ipcHost: DesktopIpcHost | undefined
  let hostContext: Awaited<ReturnType<typeof bootDesktopHost>> | undefined
  let disposeUpdater: (() => void) | undefined
  let disposeWindowState: (() => void) | undefined
  let recoveryResetTimer: NodeJS.Timeout | undefined
  const shutdownOnce = new DesktopShutdown()
  let quitting = false

  app.on('second-instance', () => {
    if (mainWindow === undefined) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })

  app.on('activate', () => {
    if (mainWindow !== undefined) mainWindow.show()
  })

  app.on('window-all-closed', () => {
    if (quitsAfterLastWindow(process.platform)) app.quit()
  })

  app.on('before-quit', (event) => {
    if (quitting) return
    event.preventDefault()
    quitting = true
    void shutdown().finally(() => { app.quit() })
  })

  app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault()
    rejectInvalidCertificate(callback)
  })

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => { event.preventDefault() })
    contents.on('will-prevent-unload', (event) => {
      handlePreventUnload(quitting, () => { event.preventDefault() })
    })
  })

  void app.whenReady().then(async () => {
    Menu.setApplicationMenu(Menu.buildFromTemplate(desktopMenuTemplate(process.platform, !app.isPackaged)))
    hostContext = await bootDesktopHost({ profile: process.env.DSH_PROFILE ?? 'web' })
    const api = hostContext.get('apiProxy')
    const connection = hostContext.get('connection')
    const clientModules = hostContext.get('clientModules')
    if (api === undefined || connection === undefined || clientModules === undefined) {
      throw new Error('desktop startup: profile must provide apiProxy, connection, and clientModules')
    }

    const appRoot = app.isPackaged ? app.getAppPath() : join(app.getAppPath(), '..')
    const protocolHandler = createDesktopProtocolHandler({
      distIndex: join(appRoot, 'dist', 'index.html'),
      clientModules,
    })
    protocol.handle('dsh-app', async request => protocolHandler(request))
    const recovery = new RendererRecoveryPolicy()
    const windowState = new DesktopWindowStateStore()
    const restoredWindow = windowState.restore()
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      ...restoredWindow,
      minWidth: 960,
      minHeight: 640,
      show: false,
      backgroundColor: '#0f1115',
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      webPreferences: desktopWebPreferences(join(appRoot, 'lib', 'preload.cjs'), !app.isPackaged),
    })
    installWindowPolicy(mainWindow)
    disposeWindowState = windowState.observe(mainWindow)
    if (restoredWindow.maximized === true) mainWindow.maximize()
    ipcHost = new DesktopIpcHost(ipcMain, api, connection, () => mainWindow?.webContents)
    ipcHost.install()
    mainWindow.once('ready-to-show', () => { mainWindow?.show() })
    mainWindow.on('close', (event) => {
      if (!hidesMainWindowOnClose(process.platform, quitting)) return
      event.preventDefault()
      mainWindow?.hide()
    })
    mainWindow.on('closed', () => { mainWindow = undefined })
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      logDesktopError(`desktop renderer exited (${details.reason})`, details)
      if (quitting || details.reason === 'clean-exit') return
      if (recovery.recordFailure() === 'reload') mainWindow?.reload()
      else logDesktopError('desktop renderer automatic recovery stopped', details)
    })
    await mainWindow.loadURL(DESKTOP_APP_URL)
    recoveryResetTimer = setTimeout(() => { recovery.reset() }, 60_000)
    recoveryResetTimer.unref()
    if (app.isPackaged && process.env.DSH_DESKTOP_DISABLE_UPDATES !== '1') {
      disposeUpdater = installDesktopUpdater(mainWindow)
    }
    if (process.env.DSH_DESKTOP_SMOKE === '1') {
      const result: unknown = await mainWindow.webContents.executeJavaScript(`({
        bridge: typeof globalThis.dshDesktop === 'object',
        nodeGlobal: typeof globalThis.process,
        rootText: document.querySelector('#root')?.textContent ?? '',
      })`)
      const output = `DSH_DESKTOP_SMOKE ${JSON.stringify(result)}`
      console.log(output)
      if (process.env.DSH_DESKTOP_SMOKE_FILE) appendFileSync(process.env.DSH_DESKTOP_SMOKE_FILE, `${output}\n`)
      quitting = true
      await shutdown()
      app.exit(0)
    }
  }).catch((error: unknown) => {
    logDesktopError('desktop startup failed', error)
    console.error('desktop startup failed', formatStartupError(error))
    app.exit(1)
  })

  function shutdown(): Promise<void> {
    return shutdownOnce.run(async () => {
      mainWindow?.hide()
      disposeUpdater?.()
      disposeUpdater = undefined
      disposeWindowState?.()
      disposeWindowState = undefined
      if (recoveryResetTimer !== undefined) clearTimeout(recoveryResetTimer)
      recoveryResetTimer = undefined
      await ipcHost?.dispose()
      ipcHost = undefined
      await hostContext?.fiber.dispose()
      hostContext = undefined
      protocol.unhandle('dsh-app')
    })
  }
}
