import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { WebBootGraph } from '@deepseek-ai/dsh-client-modules'
import { createDesktopProtocolHandler } from '../src/protocol.ts'

let root: string | undefined

afterEach(() => {
  if (root !== undefined) rmSync(root, { recursive: true, force: true })
  root = undefined
})

function fixture(): {
  readonly handle: (request: Request) => Promise<Response>
  readonly bundle: string
} {
  root = mkdtempSync(join(tmpdir(), 'dsh-desktop-protocol-'))
  const dist = join(root, 'dist')
  const bundle = join(root, 'plugin', 'client.js')
  mkdirSync(join(root, 'plugin'), { recursive: true })
  mkdirSync(join(dist, 'assets'), { recursive: true })
  writeFileSync(join(dist, 'index.html'), '<!doctype html><html><head></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>')
  writeFileSync(join(dist, 'assets', 'app.js'), 'globalThis.shellLoaded = true\n')
  writeFileSync(bundle, 'window.__ModuleLoader__.load({id:"fixture",factory:()=>({})})\n')
  writeFileSync(`${bundle}.map`, '{"version":3}\n')
  const graph: WebBootGraph = {
    rev: 'desktop-graph',
    entries: [{ id: '@fixture/plugin', url: '/plugins/@fixture/plugin/client.js?rev=1', rev: '1' }],
  }
  return {
    bundle,
    handle: createDesktopProtocolHandler({
      distIndex: join(dist, 'index.html'),
      clientModules: {
        graph: () => graph,
        clientPath: id => id === '@fixture/plugin' ? bundle : undefined,
      },
      desktopAbout: { clientVersion: '0.1.0-rc.8', upstreamBaseTag: 'dsh-v0.1.1-rc.2' },
    }),
  }
}

describe('desktop custom protocol', () => {
  it('serves the shell with the live graph and a restrictive CSP', async () => {
    const { handle } = fixture()

    const response = await handle(new Request('dsh-app://app/'))

    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain('window.__ModuleLoader__=')
    expect(html).toContain('globalThis["__DSH_BOOT__"] = {"rev":"desktop-graph"')
    expect(html).toContain('globalThis["__DSH_DESKTOP_ABOUT__"] = {"clientVersion":"0.1.0-rc.8","upstreamBaseTag":"dsh-v0.1.1-rc.2"}')
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(response.headers.get('content-security-policy')).toContain("connect-src 'none'")
    expect(response.headers.get('content-security-policy')).toMatch(/script-src 'self' 'sha256-/)
    expect(response.headers.get('content-security-policy')).not.toContain("'unsafe-eval'")
    expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin')
    expect(response.headers.get('cross-origin-resource-policy')).toBe('same-origin')
    expect(response.headers.get('permissions-policy')).toContain('camera=()')
    expect(response.headers.get('permissions-policy')).toContain('microphone=()')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
  })

  it('serves only registered bundle and source-map paths', async () => {
    const { handle } = fixture()

    const bundle = await handle(new Request('dsh-app://app/plugins/@fixture/plugin/client.js?rev=1'))
    expect(bundle.status).toBe(200)
    expect(bundle.headers.get('content-type')).toContain('text/javascript')
    expect(bundle.headers.get('cross-origin-resource-policy')).toBe('same-origin')
    expect(await bundle.text()).toContain('__ModuleLoader__')

    const map = await handle(new Request('dsh-app://app/plugins/@fixture/plugin/client.js.map'))
    expect(map.status).toBe(200)
    expect(await map.text()).toBe('{"version":3}\n')

    expect((await handle(new Request('dsh-app://app/plugins/@fixture/missing/client.js'))).status).toBe(404)
    expect((await handle(new Request('dsh-app://app/plugins/@fixture/plugin/other.js'))).status).toBe(404)
  })

  it('rejects foreign authorities, traversal, malformed escapes, and mutation methods', async () => {
    const { handle } = fixture()

    expect((await handle(new Request('dsh-app://attacker/'))).status).toBe(403)
    expect((await handle(new Request('dsh-app://app/%2e%2e/package.json'))).status).toBe(404)
    expect((await handle(new Request('dsh-app://app/%5c..%5cpackage.json'))).status).toBe(403)
    expect((await handle(new Request('dsh-app://app/%E0%A4%A'))).status).toBe(400)
    expect((await handle(new Request('dsh-app://app/', { method: 'POST' }))).status).toBe(405)
  })

  it('uses SPA fallback only for extensionless shell routes', async () => {
    const { handle } = fixture()

    expect((await handle(new Request('dsh-app://app/session/example'))).status).toBe(200)
    expect((await handle(new Request('dsh-app://app/assets/missing.js'))).status).toBe(404)
    const head = await handle(new Request('dsh-app://app/assets/app.js', { method: 'HEAD' }))
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
  })
})
