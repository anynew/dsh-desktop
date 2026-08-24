import { describe, expect, it, vi } from 'vitest'
import type { CrashReporter } from 'electron'
import { DESKTOP_PRODUCT_NAME } from '../src/app-identity.ts'
import { installDesktopCrashReporting } from '../src/crash-reporting.ts'

describe('desktop crash reporting', () => {
  it('collects local dumps without uploading user data', () => {
    const start = vi.fn()
    installDesktopCrashReporting({ start } as unknown as CrashReporter)

    expect(start).toHaveBeenCalledWith({
      productName: DESKTOP_PRODUCT_NAME,
      uploadToServer: false,
      ignoreSystemCrashHandler: false,
      rateLimit: true,
      compress: true,
    })
  })
})
