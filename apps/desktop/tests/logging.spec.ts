import { describe, expect, it } from 'vitest'
import { sanitizeDesktopLogValue } from '../src/logging.ts'

describe('desktop log sanitization', () => {
  it('redacts credential fields and bearer tokens recursively', () => {
    expect(sanitizeDesktopLogValue({
      authorization: 'Bearer abc.def',
      nested: { apiKey: 'sk-secret', safe: 'Bearer visible-secret' },
      password: 'password',
    })).toEqual({
      authorization: '[REDACTED]',
      nested: { apiKey: '[REDACTED]', safe: 'Bearer [REDACTED]' },
      password: '[REDACTED]',
    })
  })

  it('preserves error diagnostics while redacting their sensitive content', () => {
    const error = new Error('request failed with Bearer abc123', { cause: { token: 'private', status: 401 } })
    const result = sanitizeDesktopLogValue(error)

    expect(result).toMatchObject({
      name: 'Error',
      message: 'request failed with Bearer [REDACTED]',
      cause: { token: '[REDACTED]', status: 401 },
    })
  })

  it('redacts credentials embedded in URLs', () => {
    expect(sanitizeDesktopLogValue('https://example.test/path?api_key=private&safe=yes')).toBe(
      'https://example.test/path?api_key=[REDACTED]&safe=yes',
    )
  })

  it('bounds hostile diagnostic values', () => {
    let nested: Record<string, unknown> = {}
    for (let index = 0; index < 10; index += 1) nested = { nested }
    expect(JSON.stringify(sanitizeDesktopLogValue(nested))).toContain('[MaxDepth]')
    expect(String(sanitizeDesktopLogValue('x'.repeat(9000)))).toContain('[TRUNCATED]')
    expect(sanitizeDesktopLogValue(Array.from({ length: 101 }, (_, index) => index))).toHaveLength(101)
  })

  it('terminates cyclic object traversal', () => {
    const value: { self?: unknown } = {}
    value.self = value
    expect(sanitizeDesktopLogValue(value)).toEqual({ self: '[Circular]' })
  })
})
