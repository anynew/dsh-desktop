import { describe, expect, it } from 'vitest'
import { DESKTOP_APP_URL, desktopWebPreferences, isAllowedExternalUrl, isAllowedNavigation } from '../src/window-policy.ts'

describe('desktop BrowserWindow policy', () => {
  it('uses an isolated sandboxed renderer without Node integration', () => {
    expect(desktopWebPreferences('/app/preload.js', false)).toMatchObject({
      preload: '/app/preload.js',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: false,
    })
    expect(desktopWebPreferences('/app/preload.js', true).devTools).toBe(true)
  })

  it('accepts only the exact application authority', () => {
    expect(isAllowedNavigation(DESKTOP_APP_URL)).toBe(true)
    expect(isAllowedNavigation('dsh-app://app/session/one')).toBe(true)
    expect(isAllowedNavigation('dsh-app://attacker/')).toBe(false)
    expect(isAllowedNavigation('https://app/')).toBe(false)
    expect(isAllowedNavigation('file:///tmp/index.html')).toBe(false)
    expect(isAllowedNavigation('not a URL')).toBe(false)
  })

  it('opens only credential-free HTTPS destinations externally', () => {
    expect(isAllowedExternalUrl('https://docs.example.com/path')).toBe(true)
    expect(isAllowedExternalUrl('https://docs.example.com:8443/path')).toBe(true)
    expect(isAllowedExternalUrl('http://docs.example.com/path')).toBe(false)
    expect(isAllowedExternalUrl('https://user:secret@docs.example.com/path')).toBe(false)
    expect(isAllowedExternalUrl('file:///tmp/document')).toBe(false)
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false)
  })
})
