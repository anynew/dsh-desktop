import { rename } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const releaseDir = resolve(process.argv[2] ?? 'release')
const architecture = process.argv[3]
if (architecture !== 'arm64' && architecture !== 'x64') {
  throw new Error('desktop update metadata staging requires arm64 or x64')
}
await rename(join(releaseDir, 'latest-mac.yml'), join(releaseDir, `latest-mac-${architecture}.yml`))
console.log(`desktop update metadata staged for ${architecture}`)
