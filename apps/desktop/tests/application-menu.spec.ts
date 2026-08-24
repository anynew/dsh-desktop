import { describe, expect, it } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'
import { desktopMenuTemplate } from '../src/application-menu.ts'

function roles(items: MenuItemConstructorOptions[]): unknown[] {
  return items.map(item => item.role ?? item.label)
}

function submenu(template: MenuItemConstructorOptions[], label: string): MenuItemConstructorOptions[] {
  const item = template.find(row => row.label === label)
  if (!Array.isArray(item?.submenu)) throw new Error(`missing ${label} submenu`)
  return item.submenu
}

describe('desktop application menu', () => {
  it('uses the native macOS app and close menus', () => {
    const template = desktopMenuTemplate('darwin', false)
    expect(roles(template)).toEqual(['appMenu', 'fileMenu', 'editMenu', 'View', 'windowMenu'])
    expect(template[1]?.submenu).toEqual([{ role: 'close' }])
  })

  it('uses quit in the Windows and Linux file menu', () => {
    for (const platform of ['win32', 'linux'] as const) {
      const template = desktopMenuTemplate(platform, false)
      expect(roles(template)).toEqual(['fileMenu', 'editMenu', 'View', 'windowMenu'])
      expect(template[0]?.submenu).toEqual([{ role: 'quit' }])
    }
  })

  it('omits developer tools from packaged application menus', () => {
    expect(roles(submenu(desktopMenuTemplate('darwin', false), 'View'))).not.toContain('toggleDevTools')
    expect(roles(submenu(desktopMenuTemplate('darwin', true), 'View'))).toContain('toggleDevTools')
  })
})
