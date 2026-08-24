import { describe, expect, it, vi } from 'vitest'
import { installDesktopCommandLinePolicy } from '../src/command-line-policy.ts'

describe('desktop Chromium command-line policy', () => {
  it('disables unused background network capabilities', () => {
    const switches: Array<[string, string | undefined]> = []
    const appendSwitch = vi.fn((name: string, value?: string) => { switches.push([name, value]) })
    installDesktopCommandLinePolicy({ appendSwitch })

    expect(switches).toContainEqual(['disable-component-update', undefined])
    const features = switches.find(([name]) => name === 'disable-features')?.[1]
    expect(features?.split(',')).toEqual([
      'AutofillServerCommunication',
      'InterestFeedContentSuggestions',
      'MediaRouter',
      'OptimizationHints',
      'Translate',
    ])
  })
})
