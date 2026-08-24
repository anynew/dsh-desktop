/** Chromium switches fixed before Electron readiness. */

/** Minimal Electron command-line API used by desktop startup. */
export interface DesktopCommandLine {
  appendSwitch(name: string, value?: string): void
}

/** Disable browser capabilities that the local desktop renderer does not use. */
export function installDesktopCommandLinePolicy(commandLine: DesktopCommandLine): void {
  commandLine.appendSwitch('disable-features', [
    'AutofillServerCommunication',
    'InterestFeedContentSuggestions',
    'MediaRouter',
    'OptimizationHints',
    'Translate',
  ].join(','))
  commandLine.appendSwitch('disable-component-update')
}
