import { describe, expect, it } from 'vitest'
import { hidesMainWindowOnClose, quitsAfterLastWindow } from '../src/platform-lifecycle.ts'

describe('desktop platform lifecycle', () => {
  it('keeps the macOS application active after its window closes', () => {
    expect(quitsAfterLastWindow('darwin')).toBe(false)
    expect(hidesMainWindowOnClose('darwin', false)).toBe(true)
    expect(hidesMainWindowOnClose('darwin', true)).toBe(false)
  })

  it('terminates after the last window on Windows and Linux', () => {
    expect(quitsAfterLastWindow('win32')).toBe(true)
    expect(quitsAfterLastWindow('linux')).toBe(true)
    expect(hidesMainWindowOnClose('win32', false)).toBe(false)
    expect(hidesMainWindowOnClose('linux', false)).toBe(false)
  })
})
