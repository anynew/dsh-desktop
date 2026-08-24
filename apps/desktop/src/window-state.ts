/** Durable main-window placement constrained to the current display topology. */

import type { BrowserWindow, Rectangle } from 'electron'
import { screen } from 'electron'
import Store from 'electron-store'

const MIN_WIDTH = 960
const MIN_HEIGHT = 640
const SAVE_DELAY_MS = 250

/** Persisted placement fields; maximized state is restored after bounds. */
export interface DesktopWindowState extends Rectangle {
  readonly maximized: boolean
}

/** Restore and persist desktop window placement. */
export class DesktopWindowStateStore {
  private readonly store: Pick<Store<{ window?: DesktopWindowState }>, 'get' | 'set'>

  /** @param store - durable state adapter, injectable for lifecycle tests. */
  constructor(store: Pick<Store<{ window?: DesktopWindowState }>, 'get' | 'set'> = new Store({ name: 'desktop-window-state' })) {
    this.store = store
  }

  /**
   * Return saved bounds when they intersect a current display's work area.
   * @returns safe BrowserWindow options, or an empty object for platform defaults.
   */
  restore(): Partial<Rectangle> & { maximized?: boolean } {
    return safeDesktopWindowState(this.store.get('window'), screen.getAllDisplays().map(display => display.workArea))
  }

  /**
   * Persist normal bounds and maximized state until the window closes.
   * @param window - application window whose movement and resize events are observed.
   * @returns disposer for the registered listeners.
   */
  observe(window: BrowserWindow): () => void {
    const save = (): void => {
      const bounds = window.getNormalBounds()
      this.store.set('window', { ...bounds, maximized: window.isMaximized() })
    }
    let timer: NodeJS.Timeout | undefined
    const schedule = (): void => {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        save()
      }, SAVE_DELAY_MS)
      timer.unref()
    }
    window.on('resize', schedule)
    window.on('move', schedule)
    window.on('maximize', schedule)
    window.on('unmaximize', schedule)
    return () => {
      if (timer !== undefined) clearTimeout(timer)
      save()
      window.removeListener('resize', schedule)
      window.removeListener('move', schedule)
      window.removeListener('maximize', schedule)
      window.removeListener('unmaximize', schedule)
    }
  }
}

/**
 * Validate saved placement against current display work areas.
 * @param value - persisted window state.
 * @param workAreas - current display work areas.
 * @returns the saved placement when visible and large enough, otherwise platform defaults.
 */
export function safeDesktopWindowState(
  value: DesktopWindowState | undefined,
  workAreas: readonly Rectangle[],
): Partial<Rectangle> & { maximized?: boolean } {
  if (value === undefined || !isFiniteState(value) || value.width < MIN_WIDTH || value.height < MIN_HEIGHT) return {}
  const workArea = workAreas.find(area => intersects(value, area))
  if (workArea === undefined) return {}
  return {
    x: clamp(value.x, workArea.x, workArea.x + workArea.width - MIN_WIDTH),
    y: clamp(value.y, workArea.y, workArea.y + workArea.height - MIN_HEIGHT),
    width: Math.min(value.width, workArea.width),
    height: Math.min(value.height, workArea.height),
    maximized: value.maximized,
  }
}

function isFiniteState(value: DesktopWindowState): boolean {
  return [value.x, value.y, value.width, value.height].every(Number.isFinite)
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

function intersects(left: Rectangle, right: Rectangle): boolean {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y
}
