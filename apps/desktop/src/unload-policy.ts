/** Renderer beforeunload handling during application shutdown. */

/**
 * Ignore a renderer beforeunload veto only after native application shutdown begins.
 * @param quitting - whether the main process owns an active quit sequence.
 * @param allowUnload - Electron callback represented by preventing `will-prevent-unload`.
 */
export function handlePreventUnload(quitting: boolean, allowUnload: () => void): void {
  if (quitting) allowUnload()
}
