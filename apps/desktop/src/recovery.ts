/** Bounded renderer recovery policy for the Electron main process. */

const RECOVERY_WINDOW_MS = 60_000
const MAX_AUTOMATIC_RELOADS = 2

/** Decision returned after an unexpected renderer exit. */
export type RendererRecoveryAction = 'reload' | 'stop'

/** Prevent an unstable renderer from entering an unbounded reload loop. */
export class RendererRecoveryPolicy {
  private readonly failures: number[] = []

  /**
   * Record an unexpected exit and select the recovery action.
   * @param now current monotonic-compatible timestamp in milliseconds.
   * @returns `reload` while the bounded retry budget remains, otherwise `stop`.
   */
  recordFailure(now = Date.now()): RendererRecoveryAction {
    while (this.failures[0] !== undefined && now - this.failures[0] > RECOVERY_WINDOW_MS) this.failures.shift()
    this.failures.push(now)
    return this.failures.length <= MAX_AUTOMATIC_RELOADS ? 'reload' : 'stop'
  }

  /** Clear failure history after a renderer remains healthy. */
  reset(): void {
    this.failures.length = 0
  }
}
