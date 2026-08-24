/** Desktop-only session header geometry is activated by the Electron marker. */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  fileURLToPath(new URL('../src/client/skeleton/ConversationRoot.module.css', import.meta.url)),
  'utf8',
)

describe('ConversationRoot desktop header styles', () => {
  it('keeps browser chrome separate behind the desktop renderer marker', () => {
    expect(css).toContain(':global(html[data-dsh-desktop]) .header')
    expect(css).toContain(':global(html[data-dsh-desktop]) .desktopWorkspaceTitle')
    expect(css).toContain(':global(html[data-dsh-desktop]) .desktopSessionTitle')
    expect(css).toContain(':global(html[data-dsh-desktop]) .crumbs')
  })

  it('makes workspace the durable title and removes session context first when narrow', () => {
    expect(css).toMatch(/\.desktopWorkspaceTitle\s*\{[\s\S]*?font-size:\s*16px;[\s\S]*?font-weight:\s*600;/)
    expect(css).toMatch(/@media \(max-width: 680px\)[\s\S]*?\.desktopSessionTitle\s*\{\s*display:\s*none;/)
    expect(css).toMatch(/\.tabs\s*\{[\s\S]*?padding-left:\s*0;/)
  })
})
