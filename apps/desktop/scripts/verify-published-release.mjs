import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

const releaseDir = resolve(process.argv[2] ?? 'release')
const manifest = JSON.parse(await readFile(join(releaseDir, 'release-manifest.json'), 'utf8'))
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files)) {
  throw new Error('desktop published release: invalid release-manifest.json')
}
for (const file of manifest.files) {
  if (!isRecord(file) || typeof file.name !== 'string' || typeof file.sha256 !== 'string' || typeof file.size !== 'number') {
    throw new Error('desktop published release: invalid artifact row')
  }
  const path = join(releaseDir, basename(file.name))
  const response = await fetch(`https://github.com/deepseek-ai/deepseek-harness/releases/download/dsh-v${manifest.version}/${encodeURIComponent(basename(file.name))}`, { redirect: 'follow' })
  if (!response.ok || response.body === null) throw new Error(`desktop published release: download failed for ${file.name}: HTTP ${response.status}`)
  const hash = createHash('sha256')
  let size = 0
  for await (const chunk of response.body) {
    hash.update(chunk)
    size += chunk.byteLength
  }
  const sha256 = hash.digest('hex')
  if (size !== file.size || sha256 !== file.sha256) throw new Error(`desktop published release: downloaded artifact mismatch for ${file.name}`)
  const localHash = await digest(path).catch(() => undefined)
  if (localHash !== undefined && localHash !== sha256) throw new Error(`desktop published release: local artifact mismatch for ${file.name}`)
}
console.log(`desktop published release verified: ${manifest.files.length} downloadable artifact(s)`)

async function digest(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
