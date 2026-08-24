import { describe, expect, it, vi } from 'vitest'
import type { ApiProxy } from '../src/api/index.ts'
import type { ClientResponse, RpcReceipt, RpcRequest } from '../src/api/rpc.ts'
import type { RequestPayload } from '../src/api/rpc-map.ts'
import { RpcId } from '../src/api/rpc.ts'
import {
  dispatchClientRequest,
  dispatchClientResponse,
  dispatchRoutedClientRequest,
  INVALID_REQUEST_RPC_ID,
} from '../src/carrier/host.ts'

function api(): ApiProxy {
  return {
    sessions: {
      list: async (request: RpcRequest<RequestPayload<'session.list'>>) => ({ rpcId: request.rpcId, result: { ok: true, value: { items: [] } } }),
    },
    respond: async (message: ClientResponse): Promise<RpcReceipt> =>
      message.rpcId === 'pending' ? { accepted: true } : { accepted: false, reason: 'not-pending' },
  } as unknown as ApiProxy
}

describe('carrier-independent host dispatch', () => {
  it('validates and dispatches a full client request', async () => {
    const response = await dispatchClientRequest(api(), {
      type: 'client-request',
      rpcId: RpcId('request-1'),
      method: 'session.list',
      payload: {},
    }, new AbortController().signal)

    expect(response).toEqual({
      type: 'server-response',
      rpcId: 'request-1',
      result: { ok: true, value: { items: [] } },
    })
  })

  it('keeps malformed and unknown requests correlated', async () => {
    await expect(dispatchClientRequest(api(), null, new AbortController().signal)).resolves.toMatchObject({
      rpcId: INVALID_REQUEST_RPC_ID,
      result: { ok: false, error: { code: 'bad-request' } },
    })
    await expect(dispatchClientRequest(api(), {
      type: 'client-request', rpcId: 'known-id', method: 'unknown', payload: {},
    }, new AbortController().signal)).resolves.toMatchObject({
      rpcId: 'known-id',
      result: { ok: false, error: { code: 'bad-request' } },
    })
  })

  it('rejects route disagreement and invalid payloads before invocation', async () => {
    const sessions = { list: vi.fn() }
    const target = { ...api(), sessions } as unknown as ApiProxy
    const mismatched = {
      type: 'client-request', rpcId: RpcId('route'), method: 'session.create', payload: {},
    }
    const malformed = {
      type: 'client-request', rpcId: RpcId('payload'), method: 'session.list', payload: null,
    }

    await expect(dispatchRoutedClientRequest(
      target, 'session.list', mismatched, new AbortController().signal,
    )).resolves.toMatchObject({ result: { ok: false, error: { code: 'bad-request' } } })
    await expect(dispatchRoutedClientRequest(
      target, 'session.list', malformed, new AbortController().signal,
    )).resolves.toMatchObject({ result: { ok: false, error: { code: 'bad-request' } } })
    expect(sessions.list).not.toHaveBeenCalled()
  })

  it('forwards carrier cancellation to signal-aware methods', async () => {
    const search = vi.fn(async (request: RpcRequest<RequestPayload<'session.search'>>, signal: AbortSignal) => ({
      rpcId: request.rpcId,
      result: signal.aborted
        ? { ok: false as const, error: { code: 'cancelled' as const, message: 'cancelled', details: {} } }
        : { ok: true as const, value: { items: [], hasMore: false } },
    }))
    const target = { ...api(), sessions: { search } } as unknown as ApiProxy
    const controller = new AbortController()
    controller.abort()

    const response = await dispatchClientRequest(target, {
      type: 'client-request', rpcId: RpcId('cancel'), method: 'session.search', payload: { query: 'x' },
    }, controller.signal)

    expect(search).toHaveBeenCalledWith(expect.anything(), controller.signal)
    expect(response.result).toMatchObject({ ok: false, error: { code: 'cancelled' } })
  })

  it('lets implementation failures reject for the physical carrier to map', async () => {
    const target = {
      ...api(),
      sessions: { list: async () => { throw new Error('boom') } },
    } as unknown as ApiProxy

    await expect(dispatchClientRequest(target, {
      type: 'client-request', rpcId: RpcId('crash'), method: 'session.list', payload: {},
    }, new AbortController().signal)).rejects.toThrow('boom')
  })

  it('validates client responses before delivery', async () => {
    await expect(dispatchClientResponse(api(), {
      type: 'client-response', rpcId: RpcId('pending'), result: { ok: true, value: { answer: true } },
    })).resolves.toEqual({ accepted: true })
    await expect(dispatchClientResponse(api(), { type: 'wrong' })).resolves.toEqual({
      accepted: false,
      reason: 'bad-response',
    })
  })
})
