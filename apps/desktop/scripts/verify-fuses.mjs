import { basename, resolve } from 'node:path'
import { readdir } from 'node:fs/promises'
import { FuseState, FuseV1Options, getCurrentFuseWire } from '@electron/fuses'

const releaseDir = resolve(process.argv[2] ?? 'release')
const executables = await discover(releaseDir)
if (executables.length === 0) throw new Error(`desktop fuse verification: no application executable under ${releaseDir}`)

const expected = new Map([
  [FuseV1Options.RunAsNode, FuseState.DISABLE],
  [FuseV1Options.EnableCookieEncryption, FuseState.ENABLE],
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseState.DISABLE],
  [FuseV1Options.EnableNodeCliInspectArguments, FuseState.DISABLE],
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation, FuseState.ENABLE],
  [FuseV1Options.OnlyLoadAppFromAsar, FuseState.ENABLE],
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot, FuseState.DISABLE],
  [FuseV1Options.GrantFileProtocolExtraPrivileges, FuseState.DISABLE],
  [FuseV1Options.WasmTrapHandlers, FuseState.ENABLE],
])

for (const executable of executables) {
  const wire = await getCurrentFuseWire(executable)
  for (const [fuse, state] of expected) {
    if (wire[fuse] !== state) throw new Error(`${executable}: unexpected ${FuseV1Options[fuse]} fuse state ${wire[fuse]}`)
  }
}
console.log(`desktop fuse verification: ${executables.length} application executable(s) passed`)

async function discover(directory) {
  const result = []
  for await (const path of walk(directory)) {
    if (process.platform === 'darwin' && path.endsWith('.app/Contents/MacOS/DeepSeek Harness')) result.push(path)
    if (process.platform === 'win32' && basename(path) === 'DeepSeek Harness.exe') result.push(path)
  }
  return result.sort()
}

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (entry.isFile()) yield path
  }
}
