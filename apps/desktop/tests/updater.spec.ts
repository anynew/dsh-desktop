import { describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import { installDesktopUpdater, type DesktopUpdater, type DesktopUpdaterEnvironment } from '../src/updater.ts'

function setup(checkForUpdates = vi.fn(async () => undefined)) {
  const listeners = new Map<string, (...args: never[]) => void>()
  const quitAndInstall = vi.fn()
  const removeListener = vi.fn((event: string) => { listeners.delete(event) })
  const updater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowDowngrade: true,
    isUpdateSupported: vi.fn(() => true),
    on: vi.fn((event: string, listener: (...args: never[]) => void) => { listeners.set(event, listener) }),
    removeListener,
    checkForUpdates,
    quitAndInstall,
  } as unknown as DesktopUpdater
  const timer = { unref: vi.fn() } as unknown as ReturnType<typeof setInterval>
  const environment = {
    updater,
    currentVersion: '1.2.3',
    showReady: vi.fn(async () => true),
    setInterval: vi.fn(() => timer),
    clearInterval: vi.fn(),
  } satisfies DesktopUpdaterEnvironment
  const dispose = installDesktopUpdater({} as BrowserWindow, environment)
  return {
    dispose,
    environment,
    listeners,
    timer,
    updater,
    checkForUpdates,
    quitAndInstall,
    removeListener,
  }
}

describe('desktop updater', () => {
  it('checks immediately and installs an accepted verified update', async () => {
    const { checkForUpdates, environment, listeners, quitAndInstall, updater } = setup()

    expect(updater).toMatchObject({ autoDownload: true, autoInstallOnAppQuit: true, allowDowngrade: false })
    expect(checkForUpdates).toHaveBeenCalledOnce()
    listeners.get('update-downloaded')?.()
    await vi.waitFor(() => { expect(quitAndInstall).toHaveBeenCalledWith(false, true) })
    expect(environment.showReady).toHaveBeenCalledOnce()
  })

  it('does not overlap periodic checks', async () => {
    let settle: (() => void) | undefined
    const checkForUpdates = vi.fn(() => new Promise<void>((resolve) => { settle = resolve }))
    const { environment } = setup(checkForUpdates)
    const scheduled = environment.setInterval.mock.calls[0]?.[0]

    scheduled?.()
    expect(checkForUpdates).toHaveBeenCalledOnce()
    settle?.()
    await vi.waitFor(() => { scheduled?.(); expect(checkForUpdates).toHaveBeenCalledTimes(2) })
  })

  it('does not restart after disposal and removes owned listeners', async () => {
    const { dispose, environment, listeners, quitAndInstall, removeListener, timer } = setup()
    const downloaded = listeners.get('update-downloaded')

    dispose()
    downloaded?.()
    await vi.waitFor(() => { expect(environment.showReady).toHaveBeenCalledOnce() })
    expect(quitAndInstall).not.toHaveBeenCalled()
    expect(environment.clearInterval).toHaveBeenCalledWith(timer)
    expect(removeListener).toHaveBeenCalledTimes(2)
  })
})
