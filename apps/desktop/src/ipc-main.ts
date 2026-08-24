/** Main-process owner of the validated Electron API transport and its lifecycles. */

import { randomUUID } from 'node:crypto'
import type { WebContents } from 'electron'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import type { ApiProxy, HostFrame, MuxFrame, RpcRequest, ServerRequest } from '@deepseek-ai/dsh-host-apiproxy/api'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api'
import { dispatchClientRequest, dispatchClientResponse } from '@deepseek-ai/dsh-host-apiproxy/carrier/host'
import {
  DESKTOP_IPC,
  type DesktopOperationId,
  type DesktopRequestResult,
  type DesktopRespondResult,
  type DesktopStreamId,
  type DesktopStreamKind,
  type DesktopStreamMessage,
  type DesktopStreamOpen,
} from './ipc-contract.ts'

/** Minimal Electron IPC Main face, injectable for process-free tests. */
export interface DesktopIpcMain {
  handle(channel: string, listener: (event: DesktopIpcEvent, ...args: unknown[]) => unknown): void
  on(channel: string, listener: (event: DesktopIpcEvent, ...args: unknown[]) => void): void
  removeHandler(channel: string): void
  removeAllListeners(channel: string): void
}

/** Sender facts required for authorization and reply delivery. */
export interface DesktopIpcEvent {
  readonly sender: WebContents
  readonly senderFrame: { readonly url: string } | null
}

interface PendingOperation {
  readonly senderId: number
  readonly abort: AbortController
  settled: Promise<void>
}

interface PendingStream {
  readonly senderId: number
  readonly abort: AbortController
  readonly settled: Promise<void>
}

/** Exact app origin accepted by every privileged IPC call. */
export const DESKTOP_APP_ORIGIN = 'dsh-app://app'
const MAX_IPC_NODES = 100_000
const MAX_IPC_DEPTH = 64
const MAX_IPC_STRING_LENGTH = 8 * 1024 * 1024

/** Convert one narrow Host frame to the full process-boundary envelope. */
export function fullDesktopFrame(narrow: RpcRequest<MuxFrame | HostFrame>): ServerRequest {
  return {
    type: 'server-request',
    rpcId: narrow.rpcId,
    method: narrow.payload.type,
    payload: narrow.payload,
  }
}

/**
 * Own the IPC handlers for one Host API and one authorized renderer.
 * Disposal stops accepting calls, aborts all work, and awaits stream quiescence.
 */
export class DesktopIpcHost {
  private readonly operations = new Map<DesktopOperationId, PendingOperation>()
  private readonly streams = new Map<DesktopStreamId, PendingStream>()
  private installed = false

  constructor(
    private readonly ipcMain: DesktopIpcMain,
    private readonly api: ApiProxy,
    private readonly connection: HostConnectionHandle,
    private readonly renderer: () => WebContents | undefined,
  ) {}

  /** Install the closed channel set exactly once. */
  install(): void {
    if (this.installed) throw new Error('desktop IPC host is already installed')
    this.installed = true
    this.ipcMain.handle(DESKTOP_IPC.request, (event, operationId, message) =>
      this.request(event, operationId as DesktopOperationId, message))
    this.ipcMain.handle(DESKTOP_IPC.respond, (event, operationId, message) =>
      this.respond(event, operationId as DesktopOperationId, message))
    this.ipcMain.handle(DESKTOP_IPC.rpc, (event, operationId, channel, endpoint, payload) =>
      this.rpc(event, operationId as DesktopOperationId, channel, endpoint, payload))
    this.ipcMain.handle(DESKTOP_IPC.openStream, (event, request) => {
      this.openStream(event, request)
    })
    this.ipcMain.on(DESKTOP_IPC.cancelOperation, (event, operationId) => {
      this.assertSender(event)
      this.cancelOperation(operationId as DesktopOperationId, event.sender.id)
    })
    this.ipcMain.on(DESKTOP_IPC.cancelStream, (event, streamId) => {
      this.assertSender(event)
      this.cancelStream(streamId as DesktopStreamId, event.sender.id)
    })
  }

  /** Remove handlers, abort all work, and wait until every stream pump exits. */
  async dispose(): Promise<void> {
    if (!this.installed) return
    this.installed = false
    this.ipcMain.removeHandler(DESKTOP_IPC.request)
    this.ipcMain.removeHandler(DESKTOP_IPC.respond)
    this.ipcMain.removeHandler(DESKTOP_IPC.rpc)
    this.ipcMain.removeHandler(DESKTOP_IPC.openStream)
    this.ipcMain.removeAllListeners(DESKTOP_IPC.cancelOperation)
    this.ipcMain.removeAllListeners(DESKTOP_IPC.cancelStream)
    const operations = [...this.operations.values()]
    for (const operation of operations) operation.abort.abort()
    const streams = [...this.streams.values()]
    this.streams.clear()
    for (const stream of streams) stream.abort.abort()
    await Promise.allSettled([
      ...operations.map(operation => operation.settled),
      ...streams.map(stream => stream.settled),
    ])
  }

  private async request(event: DesktopIpcEvent, operationId: DesktopOperationId, message: unknown): Promise<DesktopRequestResult> {
    this.assertSender(event)
    assertBoundedIpcValue(message)
    return this.runOperation(operationId, event.sender.id, signal =>
      dispatchClientRequest(this.api, message, signal).then(response => ({ response })))
  }

  private async respond(event: DesktopIpcEvent, operationId: DesktopOperationId, message: unknown): Promise<DesktopRespondResult> {
    this.assertSender(event)
    assertBoundedIpcValue(message)
    return this.runOperation(operationId, event.sender.id, async () => ({
      receipt: await dispatchClientResponse(this.api, message),
    }))
  }

  private async rpc(
    event: DesktopIpcEvent,
    operationId: DesktopOperationId,
    channel: unknown,
    endpoint: unknown,
    payload: unknown,
  ): Promise<DesktopRequestResult> {
    this.assertSender(event)
    if (!isRpcTarget(channel) || !isRpcTarget(endpoint)) throw new Error('desktop IPC invalid RPC target')
    assertBoundedIpcValue(payload)
    return this.runOperation(operationId, event.sender.id, async signal => ({
      response: {
        type: 'server-response',
        rpcId: RpcId(operationId),
        result: await this.connection.rpc.dispatch(channel, endpoint, payload, signal),
      },
    }))
  }

  private async runOperation<T>(
    operationId: DesktopOperationId,
    senderId: number,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    if (!isOpaqueId(operationId)) throw new Error('desktop IPC invalid operation id')
    if (this.operations.has(operationId)) throw new Error('desktop IPC duplicate operation id')
    const abort = new AbortController()
    const work = run(abort.signal)
    const operation: PendingOperation = {
      senderId,
      abort,
      settled: work.then(() => undefined, () => undefined),
    }
    this.operations.set(operationId, operation)
    try {
      return await raceAbort(work, abort.signal)
    } finally {
      await operation.settled
      this.operations.delete(operationId)
    }
  }

  private openStream(event: DesktopIpcEvent, value: unknown): void {
    this.assertSender(event)
    if (!isStreamOpen(value)) throw new Error('desktop IPC invalid stream-open message')
    const request = value
    if (this.streams.has(request.streamId)) throw new Error('desktop IPC duplicate stream id')
    const abort = new AbortController()
    let startPump: () => void = () => {}
    const settled = new Promise<void>((resolve) => { startPump = resolve })
      .then(() => this.pump(event.sender, request.streamId, request.kind, abort.signal))
    this.streams.set(request.streamId, { senderId: event.sender.id, abort, settled })
    this.send(event.sender, { type: 'open', streamId: request.streamId })
    startPump()
  }

  private async pump(
    sender: WebContents,
    streamId: DesktopStreamId,
    kind: DesktopStreamKind,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      const source = kind === 'mux'
        ? this.api.events.mux({ rpcId: RpcId(randomUUID()), payload: {} }, signal)
        : this.api.events.host({ rpcId: RpcId(randomUUID()), payload: {} }, signal)
      for await (const frame of source) {
        if (signal.aborted) break
        this.send(sender, { type: 'frame', streamId, frame: fullDesktopFrame(frame) })
      }
    } catch (error) {
      if (!signal.aborted && !sender.isDestroyed()) {
        const failure: HostFrame = {
          type: 'stream/error',
          error: { code: 'internal', message: String(error), details: {} },
        }
        this.send(sender, {
          type: 'frame',
          streamId,
          frame: fullDesktopFrame({ rpcId: RpcId(randomUUID()), payload: failure }),
        })
      }
    } finally {
      this.streams.delete(streamId)
      if (!sender.isDestroyed()) this.send(sender, { type: 'end', streamId })
    }
  }

  private cancelOperation(operationId: DesktopOperationId, senderId: number): void {
    const operation = this.operations.get(operationId)
    if (operation?.senderId === senderId) operation.abort.abort()
  }

  private cancelStream(streamId: DesktopStreamId, senderId: number): void {
    const stream = this.streams.get(streamId)
    if (stream?.senderId === senderId) stream.abort.abort()
  }

  private assertSender(event: DesktopIpcEvent): void {
    const renderer = this.renderer()
    if (renderer === undefined || event.sender.id !== renderer.id) {
      throw new Error('desktop IPC rejected an unauthorized renderer')
    }
    if (event.senderFrame?.url.startsWith(`${DESKTOP_APP_ORIGIN}/`) !== true) {
      throw new Error('desktop IPC rejected an unauthorized frame origin')
    }
  }

  private send(sender: WebContents, message: DesktopStreamMessage): void {
    if (!sender.isDestroyed()) sender.send(DESKTOP_IPC.streamMessage, message)
  }
}

function isStreamOpen(value: unknown): value is DesktopStreamOpen {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { streamId?: unknown; kind?: unknown }
  return isOpaqueId(candidate.streamId)
    && (candidate.kind === 'mux' || candidate.kind === 'host')
}

function isOpaqueId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128
    && /^[A-Za-z0-9_-]+$/.test(value)
}

function isRpcTarget(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 256
    && /^[A-Za-z0-9_./:-]+$/.test(value)
    && !value.includes('..')
}

export function assertBoundedIpcValue(value: unknown): void {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }]
  const seen = new Set<object>()
  let nodes = 0
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined) break
    nodes += 1
    if (nodes > MAX_IPC_NODES || current.depth > MAX_IPC_DEPTH) throw new Error('desktop IPC payload exceeds structural limits')
    if (typeof current.value === 'string' && current.value.length > MAX_IPC_STRING_LENGTH) {
      throw new Error('desktop IPC payload string exceeds size limit')
    }
    if (typeof current.value !== 'object' || current.value === null || seen.has(current.value)) continue
    seen.add(current.value)
    for (const child of Array.isArray(current.value) ? current.value : Object.values(current.value)) {
      pending.push({ value: child, depth: current.depth + 1 })
    }
  }
}

function raceAbort<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError(signal))
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => { reject(abortError(signal)) }
    signal.addEventListener('abort', onAbort, { once: true })
    work.then(resolve, reject).finally(() => { signal.removeEventListener('abort', onAbort) })
  })
}

function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error('This operation was aborted')
}
