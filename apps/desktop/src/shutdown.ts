/** Single-shot ordered shutdown coordination for Electron lifecycle events. */

/** Serialize all callers onto one cleanup execution and preserve its result. */
export class DesktopShutdown {
  private settlement: Promise<void> | undefined

  /**
   * Start cleanup once or join the active cleanup.
   * @param cleanup - ordered cleanup body used only by the first caller.
   * @returns the shared cleanup settlement.
   */
  run(cleanup: () => Promise<void>): Promise<void> {
    this.settlement ??= cleanup()
    return this.settlement
  }
}
