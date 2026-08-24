/** Native application menu for standard desktop editing and window actions. */

import type { MenuItemConstructorOptions } from 'electron'

/**
 * Build the platform-native application menu template.
 * @param platform - operating system reported by Node.
 * @param development - whether diagnostic developer tools may be exposed.
 * @returns menu roles supported by Electron on the target platform.
 */
export function desktopMenuTemplate(
  platform: NodeJS.Platform,
  development: boolean,
): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = []
  if (platform === 'darwin') template.push({ role: 'appMenu' })
  template.push(
    {
      role: 'fileMenu',
      submenu: platform === 'darwin'
        ? [{ role: 'close' }]
        : [{ role: 'quit' }],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(development ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  )
  return template
}
