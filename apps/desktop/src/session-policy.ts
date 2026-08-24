/** Network session policy for the local desktop renderer. */

interface DesktopRequestDetails {
  requestHeaders: Record<string, string>
}

interface DesktopRequestResult {
  requestHeaders: Record<string, string>
}

/** Minimal Electron session API required for header filtering. */
export interface DesktopNetworkSession {
  webRequest: {
    onBeforeSendHeaders(listener: (
      details: DesktopRequestDetails,
      callback: (response: DesktopRequestResult) => void,
    ) => void): void
  }
}

/** Remove ambient identifying and navigation headers from renderer requests. */
export function installDesktopSessionPolicy(session: DesktopNetworkSession): void {
  session.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = Object.fromEntries(Object.entries(details.requestHeaders)
      .filter(([name]) => !/^(origin|referer|sec-ch-ua(?:-mobile|-platform)?)$/i.test(name)))
    callback({ requestHeaders })
  })
}
