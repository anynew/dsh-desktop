/** Platform-specific window and application lifetime rules. */

/**
 * Determine whether closing the last window terminates the application.
 * @param platform - operating system reported by Node.
 * @returns `false` on macOS, where applications remain active without windows.
 */
export function quitsAfterLastWindow(platform: NodeJS.Platform): boolean {
  return platform !== 'darwin'
}

/**
 * Determine whether a user close gesture hides the main window instead of destroying it.
 * @param platform - operating system reported by Node.
 * @param quitting - whether an application quit is already in progress.
 * @returns `true` only for an ordinary macOS close gesture.
 */
export function hidesMainWindowOnClose(platform: NodeJS.Platform, quitting: boolean): boolean {
  return platform === 'darwin' && !quitting
}
