import { describe, expect, it, vi } from 'vitest'
import { rejectInvalidCertificate } from '../src/certificate-policy.ts'

describe('desktop certificate policy', () => {
  it('rejects every invalid certificate', () => {
    const callback = vi.fn()
    rejectInvalidCertificate(callback)
    expect(callback).toHaveBeenCalledWith(false)
  })
})
