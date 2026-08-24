import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import { DesktopWindowStateStore, safeDesktopWindowState, type DesktopWindowState } from '../src/window-state.ts'

const display = { x: 0, y: 0, width: 1920, height: 1080 }

function state(overrides: Partial<DesktopWindowState> = {}): DesktopWindowState {
  return { x: 100, y: 100, width: 1200, height: 800, maximized: false, ...overrides }
}

describe('desktop window state', () => {
  it('restores visible bounds and maximized state', () => {
    const saved = state({ maximized: true })
    expect(safeDesktopWindowState(saved, [display])).toEqual(saved)
  })

  it('rejects bounds outside the current display topology', () => {
    expect(safeDesktopWindowState(state({ x: 3000 }), [display])).toEqual({})
    expect(safeDesktopWindowState(state({ y: -2000 }), [display])).toEqual({})
  })

  it('clamps partially visible and oversized bounds to the display work area', () => {
    expect(safeDesktopWindowState(state({ x: -1100 }), [display])).toMatchObject({ x: 0, width: 1200 })
    expect(safeDesktopWindowState(state({ width: 3000, height: 2000 }), [display])).toMatchObject({
      width: 1920,
      height: 1080,
    })
  })

  it('debounces writes and flushes current state on disposal', () => {
    vi.useFakeTimers()
    const window = new EventEmitter() as EventEmitter & BrowserWindow
    window.getNormalBounds = vi.fn(() => state())
    window.isMaximized = vi.fn(() => false)
    const set = vi.fn()
    const store = new DesktopWindowStateStore({ get: vi.fn(), set })
    const dispose = store.observe(window)

    window.emit('move')
    window.emit('resize')
    expect(set).not.toHaveBeenCalled()
    vi.advanceTimersByTime(250)
    expect(set).toHaveBeenCalledOnce()
    dispose()
    expect(set).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('rejects missing, non-finite, and undersized persisted state', () => {
    expect(safeDesktopWindowState(undefined, [display])).toEqual({})
    expect(safeDesktopWindowState(state({ width: 959 }), [display])).toEqual({})
    expect(safeDesktopWindowState(state({ height: 639 }), [display])).toEqual({})
    expect(safeDesktopWindowState(state({ x: Number.NaN }), [display])).toEqual({})
    expect(safeDesktopWindowState(state({ width: Number.POSITIVE_INFINITY }), [display])).toEqual({})
  })
})
