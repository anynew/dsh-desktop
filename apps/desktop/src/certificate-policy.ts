/** TLS certificate failure policy for Electron requests. */

/**
 * Resolve a certificate validation failure.
 * @param callback - Electron certificate decision callback.
 */
export function rejectInvalidCertificate(callback: (trusted: boolean) => void): void {
  callback(false)
}
