import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve } from 'node:path'

const outputDir = resolve(process.argv[2] ?? 'release')
const packageManifest = JSON.parse(await readFile(resolve(import.meta.dirname, '../package.json'), 'utf8'))
const excluded = new Set(['SHA256SUMS', 'release-manifest.json'])
const files = []
for await (const entry of walk(outputDir)) {
  const name = relative(outputDir, entry)
  if (excluded.has(name) || name === 'builder-debug.yml' || name.includes('.app/')) continue
  files.push({ name, size: (await stat(entry)).size, sha256: await digest(entry) })
}
files.sort((left, right) => left.name.localeCompare(right.name))
await writeFile(join(outputDir, 'SHA256SUMS'), files.map(file => `${file.sha256}  ${file.name}`).join('\n') + '\n')
await writeFile(join(outputDir, 'release-manifest.json'), JSON.stringify({
  schemaVersion: 1,
  product: 'DeepSeek Harness',
  version: packageManifest.version,
  files,
}, null, 2) + '\n')
console.log(`desktop release manifest: ${files.length} artifacts in ${basename(outputDir)}`)

async function* walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) yield* walk(path)
    else if (entry.isFile()) yield path
  }
}

async function digest(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}
