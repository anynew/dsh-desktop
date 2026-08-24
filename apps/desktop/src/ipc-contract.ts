/** Typed process-boundary messages shared by Electron main, preload, and renderer. */

import type { ClientRequest, ClientResponse, RpcReceipt, ServerRequest, ServerResponse } from '@deepseek-ai/dsh-host-apiproxy/api'

/** Renderer-generated opaque operation id used only for cancellation routing. */
export type DesktopOperationId = string & { readonly __desktopOperationId: unique symbol }

/** Renderer-generated opaque stream id used only for stream lifecycle routing. */
export type DesktopStreamId = string & { readonly __desktopStreamId: unique symbol }

/** The two independent Host event streams consumed by ConnectionController. */
export type DesktopStreamKind = 'mux' | 'host'

/** Main-process result for a client-request operation. */
export interface DesktopRequestResult {
  readonly response: ServerResponse
}

/** Main-process result for a client-response delivery. */
export interface DesktopRespondResult {
  readonly receipt: RpcReceipt
}

/** Renderer request to start one lazy event stream. */
export interface DesktopStreamOpen {
  readonly streamId: DesktopStreamId
  readonly kind: DesktopStreamKind
}

/** Main-to-renderer lifecycle messages for one stream. */
export type DesktopStreamMessage =
  | { readonly type: 'open'; readonly streamId: DesktopStreamId }
  | { readonly type: 'frame'; readonly streamId: DesktopStreamId; readonly frame: ServerRequest }
  | { readonly type: 'end'; readonly streamId: DesktopStreamId }

/** Narrow bridge exposed by the context-isolated preload. */
export interface DesktopBridge {
  /** Dispatch one API request through the trusted main-process Host. */
  request(operationId: DesktopOperationId, message: ClientRequest): Promise<DesktopRequestResult>
  /** Deliver one approval/question response through the trusted Host. */
  respond(operationId: DesktopOperationId, message: ClientResponse): Promise<DesktopRespondResult>
  /** Call one logical Connection RPC endpoint through the Host registry. */
  rpc(
    operationId: DesktopOperationId,
    channel: string,
    endpoint: string,
    payload: unknown,
  ): Promise<DesktopRequestResult>
  /** Cancel one pending request, response, or generic RPC operation. */
  cancelOperation(operationId: DesktopOperationId): void
  /** Open one mux or host stream. */
  openStream(request: DesktopStreamOpen): Promise<void>
  /** Cancel one stream and await no renderer-visible acknowledgement. */
  cancelStream(streamId: DesktopStreamId): void
  /** Subscribe to all stream messages; callers demultiplex by stream id. */
  onStreamMessage(listener: (message: DesktopStreamMessage) => void): () => void
}

/** Fixed private Electron IPC channel names. */
export const DESKTOP_IPC = {
  request: 'dsh:desktop:request',
  respond: 'dsh:desktop:respond',
  rpc: 'dsh:desktop:rpc',
  cancelOperation: 'dsh:desktop:cancel-operation',
  openStream: 'dsh:desktop:open-stream',
  cancelStream: 'dsh:desktop:cancel-stream',
  streamMessage: 'dsh:desktop:stream-message',
} as const
