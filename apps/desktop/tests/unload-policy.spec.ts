import { describe, expect, it, vi } from 'vitest'
import { handlePreventUnload } from '../src/unload-policy.ts'

describe('desktop unload policy', () => {
  it('respects renderer vetoes during ordinary navigation', () => {
    const allowUnload = vi.fn()
    handlePreventUnload(false, allowUnload)
    expect(allowUnload).not.toHaveBeenCalled()
  })

  it('allows teardown after the main process owns shutdown', () => {
    const allowUnload = vi.fn()
    handlePreventUnload(true, allowUnload)
    expect(allowUnload).toHaveBeenCalledOnce()
  })
})
