/** Persistent Electron process logging and fatal-error capture. */

import log from 'electron-log/main.js'

const SECRET_KEY = /(authorization|api[-_]?key|token|password|secret|credential)/i
const BEARER = /Bearer\s+[\w.~+/=-]+/gi
const SECRET_PARAMETER = /([?&](?:api[-_]?key|token|password|secret|credential)=)[^&#\s]*/gi
const MAX_LOG_DEPTH = 8
const MAX_LOG_ITEMS = 100
const MAX_LOG_STRING = 8192

/** Remove credential-bearing fields and bound values before durable logging. */
export function sanitizeDesktopLogValue(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
  if (typeof value === 'string') {
    const sanitized = value.replace(BEARER, 'Bearer [REDACTED]').replace(SECRET_PARAMETER, '$1[REDACTED]')
    return sanitized.length > MAX_LOG_STRING ? `${sanitized.slice(0, MAX_LOG_STRING)}…[TRUNCATED]` : sanitized
  }
  if (typeof value !== 'object' || value === null) return value
  if (depth >= MAX_LOG_DEPTH) return '[MaxDepth]'
  if (seen.has(value)) return '[Circular]'
  seen.add(value)
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeDesktopLogValue(value.message),
      stack: sanitizeDesktopLogValue(value.stack),
      cause: sanitizeDesktopLogValue(value.cause, seen, depth + 1),
    }
  }
  if (Array.isArray(value)) {
    const output = value.slice(0, MAX_LOG_ITEMS).map(item => sanitizeDesktopLogValue(item, seen, depth + 1))
    if (value.length > MAX_LOG_ITEMS) output.push(`[${String(value.length - MAX_LOG_ITEMS)} more items]`)
    return output
  }
  const entries = Object.entries(value).slice(0, MAX_LOG_ITEMS).map(([key, item]) => [
    key,
    SECRET_KEY.test(key) ? '[REDACTED]' : sanitizeDesktopLogValue(item, seen, depth + 1),
  ])
  if (Object.keys(value).length > MAX_LOG_ITEMS) entries.push(['[Truncated]', '[Additional properties omitted]'])
  return Object.fromEntries(entries)
}

/** Configure rotating application logs and process-level failure capture. */
export function installDesktopLogging(): void {
  log.initialize()
  log.transports.file.maxSize = 10 * 1024 * 1024
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}'
  log.transports.file.inspectOptions = { depth: 6 }
  log.errorHandler.startCatching({ showDialog: false })
  process.on('uncaughtException', (error) => { log.error('uncaught exception', sanitizeDesktopLogValue(error)) })
  process.on('unhandledRejection', (reason) => { log.error('unhandled rejection', sanitizeDesktopLogValue(reason)) })
}

/** Record a structured desktop lifecycle failure. */
export function logDesktopError(message: string, error: unknown): void {
  log.error(message, sanitizeDesktopLogValue(error))
}
