import { describe, expect, it } from 'vitest'
import { installDesktopSessionPolicy, type DesktopNetworkSession } from '../src/session-policy.ts'

describe('desktop network session policy', () => {
  it('removes origin, referrer, and client-hint headers', () => {
    let listener: Parameters<DesktopNetworkSession['webRequest']['onBeforeSendHeaders']>[0] | undefined
    installDesktopSessionPolicy({ webRequest: { onBeforeSendHeaders(value) { listener = value } } })
    let result: Record<string, string> | undefined
    listener?.({ requestHeaders: {
      Origin: 'dsh-app://app',
      Referer: 'dsh-app://app/session',
      'sec-ch-ua': 'Chromium',
      'Sec-CH-UA-Platform': 'macOS',
      Accept: 'application/json',
    } }, (response) => { result = response.requestHeaders })
    expect(result).toEqual({ Accept: 'application/json' })
  })
})
