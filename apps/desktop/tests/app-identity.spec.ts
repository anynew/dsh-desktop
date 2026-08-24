import { describe, expect, it, vi } from 'vitest'
import type { App } from 'electron'
import { DESKTOP_APP_ID, DESKTOP_PRODUCT_NAME, installDesktopIdentity } from '../src/app-identity.ts'

function application() {
  const setName = vi.fn()
  const setAppUserModelId = vi.fn()
  return {
    app: { setName, setAppUserModelId } as unknown as App,
    setName,
    setAppUserModelId,
  }
}

describe('desktop application identity', () => {
  it('sets the product name on every platform', () => {
    const { app, setAppUserModelId, setName } = application()
    installDesktopIdentity(app, 'darwin')
    expect(setName).toHaveBeenCalledWith(DESKTOP_PRODUCT_NAME)
    expect(setAppUserModelId).not.toHaveBeenCalled()
  })

  it('sets the Windows app-model identifier', () => {
    const { app, setAppUserModelId, setName } = application()
    installDesktopIdentity(app, 'win32')
    expect(setName).toHaveBeenCalledWith(DESKTOP_PRODUCT_NAME)
    expect(setAppUserModelId).toHaveBeenCalledWith(DESKTOP_APP_ID)
  })
})
