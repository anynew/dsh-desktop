/** Desktop renderer entry: installs the IPC carrier before booting the shared GUI. */

import { AppWebEntry } from '@deepseek-ai/dsh-client-web'
import type { ClientConnectionTransport } from '@deepseek-ai/dsh-client-connection/client'
import { ElectronApiClient, createElectronConnectionRpc } from './ipc-renderer.ts'
import type { DesktopBridge } from './ipc-contract.ts'

interface DesktopWindow {
  readonly dshDesktop?: DesktopBridge
  __DSH_DESKTOP_CONNECTION__?: ClientConnectionTransport
}

const win = globalThis as DesktopWindow
const bridge = win.dshDesktop
if (bridge === undefined) throw new Error('desktop renderer: trusted preload bridge is missing')
const root = document.querySelector<HTMLElement>('#root')
if (root === null) throw new Error('desktop renderer: #root mount point is missing')
document.documentElement.dataset.dshDesktop = ''

const api = new ElectronApiClient(bridge)
win.__DSH_DESKTOP_CONNECTION__ = {
  api,
  rpc: createElectronConnectionRpc(bridge),
  isLoopback: true,
}
const app = new AppWebEntry(root)

void app.run()

window.addEventListener('beforeunload', () => {
  api.dispose()
  void app.dispose()
}, { once: true })
