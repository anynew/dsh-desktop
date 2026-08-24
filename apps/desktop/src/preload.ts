/** Context-isolated preload exposing the closed DeepSeek Harness desktop bridge. */

import { contextBridge, ipcRenderer } from 'electron'
import {
  DESKTOP_IPC,
  type DesktopBridge,
  type DesktopOperationId,
  type DesktopStreamId,
  type DesktopStreamMessage,
  type DesktopStreamOpen,
} from './ipc-contract.ts'

const bridge: DesktopBridge = Object.freeze({
  request: (operationId: DesktopOperationId, message: Parameters<DesktopBridge['request']>[1]) =>
    ipcRenderer.invoke(DESKTOP_IPC.request, operationId, message) as ReturnType<DesktopBridge['request']>,
  respond: (operationId: DesktopOperationId, message: Parameters<DesktopBridge['respond']>[1]) =>
    ipcRenderer.invoke(DESKTOP_IPC.respond, operationId, message) as ReturnType<DesktopBridge['respond']>,
  rpc: (
    operationId: DesktopOperationId,
    channel: string,
    endpoint: string,
    payload: unknown,
  ) => ipcRenderer.invoke(
    DESKTOP_IPC.rpc, operationId, channel, endpoint, payload,
  ) as ReturnType<DesktopBridge['rpc']>,
  cancelOperation(operationId: DesktopOperationId): void {
    ipcRenderer.send(DESKTOP_IPC.cancelOperation, operationId)
  },
  openStream(request: DesktopStreamOpen): Promise<void> {
    return ipcRenderer.invoke(DESKTOP_IPC.openStream, request)
  },
  cancelStream(streamId: DesktopStreamId): void {
    ipcRenderer.send(DESKTOP_IPC.cancelStream, streamId)
  },
  onStreamMessage(listener: (message: DesktopStreamMessage) => void): () => void {
    const handle = (_event: Electron.IpcRendererEvent, message: DesktopStreamMessage): void => {
      listener(message)
    }
    ipcRenderer.on(DESKTOP_IPC.streamMessage, handle)
    return () => { ipcRenderer.removeListener(DESKTOP_IPC.streamMessage, handle) }
  },
})

contextBridge.exposeInMainWorld('dshDesktop', bridge)
