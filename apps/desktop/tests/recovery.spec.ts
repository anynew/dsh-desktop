import { describe, expect, it } from 'vitest'
import { RendererRecoveryPolicy } from '../src/recovery.ts'

describe('renderer recovery policy', () => {
  it('stops after two crashes in one minute', () => {
    const policy = new RendererRecoveryPolicy()

    expect(policy.recordFailure(1_000)).toBe('reload')
    expect(policy.recordFailure(2_000)).toBe('reload')
    expect(policy.recordFailure(3_000)).toBe('stop')
  })

  it('recovers its retry budget after the window or a healthy reset', () => {
    const policy = new RendererRecoveryPolicy()

    expect(policy.recordFailure(1_000)).toBe('reload')
    expect(policy.recordFailure(62_000)).toBe('reload')
    policy.reset()
    expect(policy.recordFailure(62_001)).toBe('reload')
  })
})
