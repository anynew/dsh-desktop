/** Global name shared with the desktop-only renderer About plugin. */
export const DESKTOP_ABOUT_GLOBAL = '__DSH_DESKTOP_ABOUT__'

/** Immutable build information injected into the renderer's start page. */
export interface DesktopAboutBuild {
  /** Version declared by the Electron application package. */
  readonly clientVersion: string
  /** Fixed upstream release tag used as this build's baseline. */
  readonly upstreamBaseTag: string
}
