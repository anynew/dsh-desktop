import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'

const releaseDir = resolve(process.argv[2] ?? 'release')
const executables = await discover(releaseDir)
if (executables.length === 0) throw new Error(`desktop packaged smoke: no application executable under ${releaseDir}`)
for (const executable of executables) await smoke(executable)
console.log(`desktop packaged smoke: ${executables.length} application bundle(s) passed`)

async function discover(directory) {
  const result = []
  for await (const path of walk(directory)) {
    if (process.platform === 'darwin' && path.endsWith('.app/Contents/MacOS/DeepSeek Harness')) result.push(path)
    if (process.platform === 'win32' && basename(path) === 'DeepSeek Harness.exe') result.push(path)
  }
  return result.sort()
}

async function smoke(executable) {
  const scratch = await mkdtemp(join(tmpdir(), 'dsh-desktop-smoke-'))
  const output = join(scratch, 'smoke.txt')
  const child = spawn(executable, ['--disable-gpu', `--user-data-dir=${join(scratch, 'electron')}`], {
    env: {
      ...process.env,
      DSH_HOME: join(scratch, 'home'),
      DSH_AGENTS_HOME: join(scratch, 'agents'),
      DSH_DESKTOP_DISABLE_UPDATES: '1',
      DSH_DESKTOP_SMOKE: '1',
      DSH_DESKTOP_SMOKE_FILE: output,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let diagnostic = ''
  child.stdout.on('data', chunk => { diagnostic += chunk.toString() })
  child.stderr.on('data', chunk => { diagnostic += chunk.toString() })
  try {
    const result = await Promise.race([
      waitForExit(child),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timed out after 90 seconds')), 90_000)),
    ])
    const evidence = await readFile(output, 'utf8').catch(() => '')
    if (result !== 0 || !evidence.includes('"bridge":true') || !evidence.includes('"nodeGlobal":"undefined"') || !evidence.includes('暂无会话')) {
      throw new Error(`invalid smoke evidence (exit ${result})\n${evidence}\n${diagnostic}`)
    }
    console.log(`desktop packaged smoke passed: ${executable}`)
  } catch (error) {
    child.kill()
    throw new Error(`desktop packaged smoke failed: ${executable}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve(code ?? (signal === null ? 1 : 128)))
  })
}

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (entry.isFile()) yield path
  }
}
