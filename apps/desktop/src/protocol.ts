/** Secure custom-protocol resource handler for the desktop renderer. */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import type { ClientModuleRegistry, WebBootGraph } from '@deepseek-ai/dsh-client-modules'
import { bootInjections } from '@deepseek-ai/dsh-client-modules'
import { renderIndexInjections } from '@deepseek-ai/dsh-host-webserver'
import { DESKTOP_APP_ORIGIN } from './ipc-main.ts'

const MIME: Readonly<Record<string, string>> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
}

/** Inputs owned by the desktop Host composition. */
export interface DesktopProtocolOptions {
  /** Absolute path to the built renderer index. */
  readonly distIndex: string
  /** Live client graph and package bundle resolver. */
  readonly clientModules: Pick<ClientModuleRegistry, 'clientPath' | 'graph'>
}

/**
 * Create an Electron protocol handler with an exact authority and a confined resource root.
 * @param options - built shell path and live client module registry.
 * @returns a fetch-compatible protocol handler.
 */
export function createDesktopProtocolHandler(options: DesktopProtocolOptions): (request: Request) => Promise<Response> {
  const distIndex = resolve(options.distIndex)
  const distRoot = dirname(distIndex)
  return async (request): Promise<Response> => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return response('', 405)
    const url = new URL(request.url)
    if (`${url.protocol}//${url.host}` !== DESKTOP_APP_ORIGIN
      || url.username !== '' || url.password !== '' || url.port !== '') {
      return response('', 403)
    }
    let pathname: string
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return response('', 400)
    }
    if (pathname.includes('\\') || pathname.includes('\0')) return response('', 403)

    const plugin = resolvePluginResource(pathname, options.clientModules)
    if (plugin !== undefined) return serveFile(plugin.path, plugin.contentType, request.method === 'HEAD')
    if (pathname.startsWith('/plugins/')) return response('', 404)

    const target = resolve(distRoot, `.${pathname}`)
    if (target !== distRoot && !target.startsWith(distRoot + sep)) return response('', 403)
    if (target === distRoot || target === distIndex) {
      return serveIndex(distIndex, options.clientModules.graph(), request.method === 'HEAD')
    }
    try {
      const body = await readFile(target)
      return resourceResponse(body, MIME[extname(target)] ?? 'application/octet-stream', request.method === 'HEAD')
    } catch (error) {
      if (!isMissingResource(error)) throw error
      if (extname(target) !== '') return response('', 404)
      return serveIndex(distIndex, options.clientModules.graph(), request.method === 'HEAD')
    }
  }
}

interface PluginResource {
  readonly path: string
  readonly contentType: string
}

function resolvePluginResource(
  pathname: string,
  modules: Pick<ClientModuleRegistry, 'clientPath'>,
): PluginResource | undefined {
  const prefix = '/plugins/'
  const sourceMapSuffix = '/client.js.map'
  const bundleSuffix = '/client.js'
  const sourceMap = pathname.endsWith(sourceMapSuffix)
  const suffix = sourceMap ? sourceMapSuffix : bundleSuffix
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return undefined
  const id = pathname.slice(prefix.length, -suffix.length)
  if (id === '' || id.split('/').some(segment => segment === '' || segment === '.' || segment === '..')) return undefined
  const bundle = modules.clientPath(id)
  if (bundle === undefined) return undefined
  return {
    path: sourceMap ? `${bundle}.map` : bundle,
    contentType: sourceMap ? 'application/json; charset=utf-8' : 'text/javascript; charset=utf-8',
  }
}

async function serveIndex(path: string, graph: WebBootGraph, head: boolean): Promise<Response> {
  const html = renderIndexInjections(await readFile(path, 'utf8'), bootInjections(graph))
  const policy = contentSecurityPolicy(html)
  return new Response(head ? null : html, {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-security-policy': policy,
      'content-type': 'text/html; charset=utf-8',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-resource-policy': 'same-origin',
      'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
    },
  })
}

async function serveFile(path: string, contentType: string, head: boolean): Promise<Response> {
  try {
    return resourceResponse(await readFile(path), contentType, head)
  } catch (error) {
    if (isMissingResource(error)) return response('', 404)
    throw error
  }
}

function resourceResponse(body: Uint8Array, contentType: string, head: boolean): Response {
  return new Response(head ? null : body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer, {
    status: 200,
    headers: {
      'cache-control': 'no-cache',
      'content-type': contentType,
      'cross-origin-resource-policy': 'same-origin',
      'x-content-type-options': 'nosniff',
    },
  })
}

function response(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } })
}

function isMissingResource(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'ENOENT' || code === 'EISDIR'
}

function contentSecurityPolicy(html: string): string {
  const hashes = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map(match => `'sha256-${createHash('sha256').update(match[1] ?? '').digest('base64')}'`)
  return [
    "default-src 'none'",
    `script-src 'self' ${hashes.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'none'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ')
}
