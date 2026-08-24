import { execFileSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

const releaseDir = resolve(process.argv[2] ?? 'release')
const applications = []
const installers = []
for await (const path of walk(releaseDir)) {
  if (process.platform === 'darwin' && path.endsWith('.app')) applications.push(path)
  if (process.platform === 'win32' && basename(path) === 'DeepSeek Harness.exe') applications.push(path)
  if (process.platform === 'win32' && path.endsWith('.exe') && !path.includes('win-unpacked')) installers.push(path)
}
if (applications.length === 0) throw new Error(`desktop signature verification: no application found under ${releaseDir}`)
if (process.platform === 'darwin') {
  for (const app of applications) {
    run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', app])
    run('spctl', ['--assess', '--type', 'execute', '--verbose=2', app])
    run('xcrun', ['stapler', 'validate', app])
    console.log(`desktop signature verified: ${app}`)
  }
} else if (process.platform === 'win32') {
  if (installers.length === 0) throw new Error(`desktop signature verification: no installer found under ${releaseDir}`)
  for (const path of [...applications, ...installers]) {
    const escaped = path.replaceAll("'", "''")
    run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `$signature = Get-AuthenticodeSignature -LiteralPath '${escaped}'; if ($signature.Status -ne 'Valid') { Write-Error ($signature.Status.ToString() + ': ' + $signature.StatusMessage); exit 1 }`])
    console.log(`desktop signature verified: ${path}`)
  }
} else {
  throw new Error(`desktop signature verification: unsupported platform ${process.platform}`)
}

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' })
}

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name.endsWith('.app')) yield path
      else yield* walk(path)
    } else if (entry.isFile()) {
      yield path
    }
  }
}
