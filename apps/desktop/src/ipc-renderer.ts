/** Renderer-side desktop transport over the context-isolated preload bridge. */

import {
  RpcId,
  serverRequestSchema,
  serverResponseSchema,
  type ClientRequest,
  type ClientResponse,
  type HostFrame,
  type MuxFrame,
  type RpcRequest,
  type ServerRequest,
} from '@deepseek-ai/dsh-host-apiproxy/api'
import { hostFrameSchema, muxFrameSchema } from '@deepseek-ai/dsh-host-apiproxy/api/events.schema'
import { AbstractApiClient } from '@deepseek-ai/dsh-host-apiproxy/client'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import {
  type DesktopBridge,
  type DesktopOperationId,
  type DesktopStreamId,
  type DesktopStreamKind,
  type DesktopStreamMessage,
} from './ipc-contract.ts'

interface StreamState {
  readonly messages: DesktopStreamMessage[]
  wake: (() => void) | undefined
}

/** IPC API client preserving the same validated envelopes as the Web carrier. */
export class ElectronApiClient extends AbstractApiClient {
  private readonly streams = new Map<DesktopStreamId, StreamState>()
  private readonly unsubscribe: () => void

  constructor(private readonly bridge: DesktopBridge, timeoutMs?: number) {
    super(timeoutMs)
    this.unsubscribe = bridge.onStreamMessage((message) => { this.receive(message) })
  }

  /** Remove the preload subscription after the client Cordis tree stops. */
  dispose(): void {
    this.unsubscribe()
    for (const streamId of this.streams.keys()) this.bridge.cancelStream(streamId)
    this.streams.clear()
  }

  protected async doFetch(input: URL, init?: RequestInit): Promise<Response> {
    const path = input.pathname
    const operationId = desktopOperationId()
    const signal = init?.signal ?? undefined
    const cancel = (): void => { this.bridge.cancelOperation(operationId) }
    signal?.addEventListener('abort', cancel, { once: true })
    if (signal?.aborted === true) cancel()
    try {
      const body = parseRequestBody(init?.body)
      if (path === '/api/respond') {
        const message = body as ClientResponse
        const { receipt } = await raceAbort(this.bridge.respond(operationId, message), signal)
        return Response.json(receipt)
      }
      const message = body as ClientRequest
      const { response } = await raceAbort(this.bridge.request(operationId, message), signal)
      return Response.json(serverResponseSchema.parse(response))
    } finally {
      signal?.removeEventListener('abort', cancel)
    }
  }

  protected override openMux(
    _payload: Record<string, never>,
    signal: AbortSignal,
    onOpen?: () => void,
  ): AsyncIterable<RpcRequest<MuxFrame>> {
    return this.openDesktopStream('mux', signal, muxFrameSchema, onOpen)
  }

  protected override openHost(
    _payload: Record<string, never>,
    signal: AbortSignal,
    onOpen?: () => void,
  ): AsyncIterable<RpcRequest<HostFrame>> {
    return this.openDesktopStream('host', signal, hostFrameSchema, onOpen)
  }

  private async *openDesktopStream<F extends MuxFrame | HostFrame>(
    kind: DesktopStreamKind,
    signal: AbortSignal,
    frameSchema: { parse(value: unknown): F },
    onOpen?: () => void,
  ): AsyncGenerator<RpcRequest<F>> {
    const streamId = desktopStreamId()
    const state: StreamState = { messages: [], wake: undefined }
    this.streams.set(streamId, state)
    const abort = (): void => {
      this.bridge.cancelStream(streamId)
      state.messages.push({ type: 'end', streamId })
      state.wake?.()
      state.wake = undefined
    }
    signal.addEventListener('abort', abort, { once: true })
    try {
      if (signal.aborted) return
      await raceAbort(this.bridge.openStream({ streamId, kind }), signal)
      while (true) {
        while (state.messages.length > 0) {
          const message = state.messages.shift() as DesktopStreamMessage
          if (message.type === 'open') {
            onOpen?.()
            continue
          }
          if (message.type === 'end') return
          try {
            const full: ServerRequest = serverRequestSchema.parse(message.frame)
            const frame = frameSchema.parse(full.payload)
            this.onEnvelope(full)
            yield { rpcId: full.rpcId, payload: frame }
          } catch (error) {
            console.error(`[desktop-connection] dropping malformed ${kind} frame:`, error)
          }
        }
        await new Promise<void>((resolve) => { state.wake = resolve })
      }
    } finally {
      signal.removeEventListener('abort', abort)
      this.streams.delete(streamId)
      this.bridge.cancelStream(streamId)
    }
  }

  private receive(message: DesktopStreamMessage): void {
    const state = this.streams.get(message.streamId)
    if (state === undefined) return
    state.messages.push(message)
    state.wake?.()
    state.wake = undefined
  }
}

/** Generic Connection RPC caller over the same desktop bridge. */
export function createElectronConnectionRpc(bridge: DesktopBridge): ClientConnectionRpc {
  return {
    async call(channel, endpoint, payload, signal) {
      assertRpcTarget(channel, endpoint)
      const operationId = desktopOperationId()
      const rpcId = RpcId(operationId)
      const cancel = (): void => { bridge.cancelOperation(operationId) }
      signal?.addEventListener('abort', cancel, { once: true })
      if (signal?.aborted === true) cancel()
      try {
        const { response } = await raceAbort(
          bridge.rpc(operationId, channel, endpoint, payload), signal,
        )
        const full = serverResponseSchema.parse(response)
        if (full.rpcId !== rpcId) throw new Error('desktop RPC correlation mismatch')
        return full.result
      } finally {
        signal?.removeEventListener('abort', cancel)
      }
    },
  }
}

function parseRequestBody(body: BodyInit | null | undefined): unknown {
  if (typeof body !== 'string') throw new Error('desktop IPC accepts JSON request bodies only')
  return JSON.parse(body) as unknown
}

function desktopOperationId(): DesktopOperationId {
  return crypto.randomUUID() as DesktopOperationId
}

function desktopStreamId(): DesktopStreamId {
  return crypto.randomUUID() as DesktopStreamId
}

function raceAbort<T>(work: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return work
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

function assertRpcTarget(channel: string, endpoint: string): void {
  if (!/^\/[A-Za-z0-9._~-]+$/.test(channel)
    || endpoint.split('/').some(segment => !/^[A-Za-z0-9_$.-]+$/.test(segment))) {
    throw new Error(`desktop connection: invalid RPC target ${JSON.stringify(`${channel}/${endpoint}`)}`)
  }
}
