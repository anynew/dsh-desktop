import { describe, expect, it, vi } from 'vitest'
import type { ApiProxy, HostFrame, RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api'
import type { SessionListRequest, SessionSearchRequest } from '@deepseek-ai/dsh-host-apiproxy/api/sessions'
import type { HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import {
  assertBoundedIpcValue,
  DESKTOP_APP_ORIGIN,
  DesktopIpcHost,
  fullDesktopFrame,
  type DesktopIpcEvent,
  type DesktopIpcMain,
} from '../src/ipc-main.ts'
import { DESKTOP_IPC, type DesktopStreamId } from '../src/ipc-contract.ts'

class FakeIpcMain implements DesktopIpcMain {
  readonly handlers = new Map<string, (event: DesktopIpcEvent, ...args: unknown[]) => unknown>()
  readonly listeners = new Map<string, (event: DesktopIpcEvent, ...args: unknown[]) => void>()

  handle(channel: string, listener: (event: DesktopIpcEvent, ...args: unknown[]) => unknown): void {
    this.handlers.set(channel, listener)
  }
  on(channel: string, listener: (event: DesktopIpcEvent, ...args: unknown[]) => void): void {
    this.listeners.set(channel, listener)
  }
  removeHandler(channel: string): void { this.handlers.delete(channel) }
  removeAllListeners(channel: string): void { this.listeners.delete(channel) }
}

interface FakeSender {
  readonly value: DesktopIpcEvent['sender']
  readonly send: ReturnType<typeof vi.fn>
}

function sender(id = 7): FakeSender {
  const send = vi.fn()
  return {
    send,
    value: {
      id,
      isDestroyed: () => false,
      send,
    } as unknown as DesktopIpcEvent['sender'],
  }
}

function event(owner = sender().value, url = `${DESKTOP_APP_ORIGIN}/index.html`): DesktopIpcEvent {
  return { sender: owner, senderFrame: { url } }
}

function hostApi(signalSink?: (signal: AbortSignal) => void): ApiProxy {
  return {
    sessions: {
      list: async (request: RpcRequest<SessionListRequest>) => ({
        rpcId: request.rpcId,
        result: { ok: true, value: { items: [] } },
      }),
      search: async (request: RpcRequest<SessionSearchRequest>, signal: AbortSignal) => {
        signalSink?.(signal)
        if (!signal.aborted) {
          await new Promise<void>((resolve) => { signal.addEventListener('abort', () => { resolve() }, { once: true }) })
        }
        return { rpcId: request.rpcId, result: { ok: true, value: { items: [], hasMore: false } } }
      },
    },
    events: {
      mux: async function* (request: RpcRequest<Record<string, never>>): AsyncGenerator<RpcRequest<HostFrame>> {
        yield { rpcId: request.rpcId, payload: { type: 'stream/error', error: { code: 'internal', message: 'fixture', details: {} } } }
      },
      host: async function* () {},
    },
    respond: async () => ({ accepted: true }),
  } as unknown as ApiProxy
}

function connection(): HostConnectionHandle {
  return {
    rpc: {
      dispatch: async (_channel, endpoint) => ({ ok: true, value: { endpoint } }),
      handle: () => async () => {},
      intercept: () => async () => {},
    },
  }
}

describe('desktop IPC host', () => {
  it('dispatches validated unary and generic RPC calls for the authorized frame', async () => {
    const ipc = new FakeIpcMain()
    const owner = sender()
    const host = new DesktopIpcHost(ipc, hostApi(), connection(), () => owner.value)
    host.install()

    const unary = await ipc.handlers.get(DESKTOP_IPC.request)?.(
      event(owner.value), 'operation-1',
      { type: 'client-request', rpcId: RpcId('rpc-1'), method: 'session.list', payload: {} },
    )
    expect(unary).toMatchObject({ response: { rpcId: 'rpc-1', result: { ok: true } } })

    const rpc = await ipc.handlers.get(DESKTOP_IPC.rpc)?.(
      event(owner.value), 'operation-2', '/api', 'goals/create', { name: 'x' },
    )
    expect(rpc).toMatchObject({
      response: { rpcId: 'operation-2', result: { ok: true, value: { endpoint: 'goals/create' } } },
    })
    await host.dispose()
    expect(ipc.handlers.size).toBe(0)
    expect(ipc.listeners.size).toBe(0)
  })

  it('rejects another renderer and an unexpected frame origin', async () => {
    const ipc = new FakeIpcMain()
    const owner = sender()
    const host = new DesktopIpcHost(ipc, hostApi(), connection(), () => owner.value)
    host.install()
    const invoke = ipc.handlers.get(DESKTOP_IPC.request)!
    const message = { type: 'client-request', rpcId: 'x', method: 'session.list', payload: {} }

    await expect(() => invoke(event(sender(8).value), 'op', message)).rejects.toThrow('unauthorized renderer')
    await expect(() => invoke(event(owner.value, 'https://attacker.invalid/'), 'op', message)).rejects.toThrow('unauthorized frame origin')
    await expect(() => invoke(event(owner.value), '../invalid', message)).rejects.toThrow('invalid operation id')
    const rpc = ipc.handlers.get(DESKTOP_IPC.rpc)!
    await expect(() => rpc(event(owner.value), 'operation-3', '/api', '../escape', {})).rejects.toThrow('invalid RPC target')
    await expect(() => rpc(event(owner.value), 'operation-4', '/api', 'x'.repeat(257), {})).rejects.toThrow('invalid RPC target')
    await host.dispose()
  })

  it('propagates renderer cancellation and reaches stream quiescence on dispose', async () => {
    const ipc = new FakeIpcMain()
    const owner = sender()
    let operationSignal: AbortSignal | undefined
    const host = new DesktopIpcHost(ipc, hostApi((signal) => { operationSignal = signal }), connection(), () => owner.value)
    host.install()
    const pending = ipc.handlers.get(DESKTOP_IPC.request)!(
      event(owner.value), 'cancel-me',
      { type: 'client-request', rpcId: 'rpc', method: 'session.search', payload: { query: 'x' } },
    ) as Promise<unknown>
    await vi.waitFor(() => { expect(operationSignal).toBeDefined() })
    ipc.listeners.get(DESKTOP_IPC.cancelOperation)?.(event(owner.value), 'cancel-me')
    await expect(pending).rejects.toThrow('aborted')
    expect(operationSignal?.aborted).toBe(true)

    await ipc.handlers.get(DESKTOP_IPC.openStream)?.(event(owner.value), {
      streamId: 'mux-stream-1' as DesktopStreamId,
      kind: 'mux',
    })
    await vi.waitFor(() => {
      expect(owner.send).toHaveBeenCalledWith(DESKTOP_IPC.streamMessage, expect.objectContaining({ type: 'end' }))
    })
    await host.dispose()
  })

  it('rejects structurally excessive process-boundary payloads', () => {
    expect(() => { assertBoundedIpcValue('x'.repeat(8 * 1024 * 1024 + 1)) }).toThrow('string exceeds size limit')
    let nested: unknown = null
    for (let index = 0; index < 65; index += 1) nested = { nested }
    expect(() => { assertBoundedIpcValue(nested) }).toThrow('structural limits')
    expect(() => { assertBoundedIpcValue({ safe: ['value'] }) }).not.toThrow()
  })

  it('builds a full server-request frame without changing correlation', () => {
    expect(fullDesktopFrame({
      rpcId: RpcId('frame-1'),
      payload: { type: 'stream/error', error: { code: 'internal', message: 'x', details: {} } },
    })).toEqual({
      type: 'server-request',
      rpcId: 'frame-1',
      method: 'stream/error',
      payload: { type: 'stream/error', error: { code: 'internal', message: 'x', details: {} } },
    })
  })
})
