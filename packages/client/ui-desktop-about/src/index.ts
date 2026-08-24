/** Name of the immutable desktop build-information global. */
export const DESKTOP_ABOUT_GLOBAL = '__DSH_DESKTOP_ABOUT__'

/** Build information injected into the Electron renderer before client boot. */
export interface DesktopAboutBuild {
  /** Version declared by the Electron application package. */
  readonly clientVersion: string
  /** Fixed upstream release tag used as this build's baseline. */
  readonly upstreamBaseTag: string
}

/** Node half; this package contributes its UI through the client entrypoint. */
export function apply(): void {}
