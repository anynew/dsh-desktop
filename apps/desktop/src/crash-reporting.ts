/** Local-only native crash dump collection for production diagnostics. */

import type { CrashReporter } from 'electron'
import { DESKTOP_PRODUCT_NAME } from './app-identity.ts'

/** Start crash collection without uploading user data to an external service. */
export function installDesktopCrashReporting(reporter: CrashReporter): void {
  reporter.start({
    productName: DESKTOP_PRODUCT_NAME,
    uploadToServer: false,
    ignoreSystemCrashHandler: false,
    rateLimit: true,
    compress: true,
  })
}
