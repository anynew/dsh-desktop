import { describe, expect, it, vi } from 'vitest'
import { DesktopShutdown } from '../src/shutdown.ts'

describe('desktop shutdown', () => {
  it('runs cleanup once for concurrent and later callers', async () => {
    const shutdown = new DesktopShutdown()
    let settle: (() => void) | undefined
    const cleanup = vi.fn(() => new Promise<void>((resolve) => { settle = resolve }))

    const first = shutdown.run(cleanup)
    const second = shutdown.run(cleanup)
    expect(cleanup).toHaveBeenCalledOnce()
    expect(second).toBe(first)
    settle?.()
    await first
    expect(shutdown.run(cleanup)).toBe(first)
    expect(cleanup).toHaveBeenCalledOnce()
  })

  it('shares cleanup rejection without retrying partial teardown', async () => {
    const shutdown = new DesktopShutdown()
    const failure = new Error('cleanup failed')
    const cleanup = vi.fn(async () => { throw failure })

    await expect(shutdown.run(cleanup)).rejects.toBe(failure)
    await expect(shutdown.run(cleanup)).rejects.toBe(failure)
    expect(cleanup).toHaveBeenCalledOnce()
  })
})
