import { readFile, unlink, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import yaml from 'js-yaml'

const releaseDir = resolve(process.argv[2] ?? 'release')
const inputs = ['latest-mac-arm64.yml', 'latest-mac-x64.yml']
const documents = await Promise.all(inputs.map(async name => yaml.load(await readFile(join(releaseDir, name), 'utf8'))))
if (!documents.every(isMetadata)) throw new Error('desktop mac update metadata: invalid architecture metadata')
const [first, second] = documents
if (first.version !== second.version) throw new Error('desktop mac update metadata: architecture versions differ')
const files = [...first.files, ...second.files]
const names = new Set(files.map(file => basename(file.url)))
if (names.size !== files.length || ![...names].some(name => name.includes('arm64')) || ![...names].some(name => name.includes('x64'))) {
  throw new Error('desktop mac update metadata: unique arm64 and x64 payloads are required')
}
const merged = { ...first, files, path: undefined, sha512: undefined }
await writeFile(join(releaseDir, 'latest-mac.yml'), yaml.dump(merged, { lineWidth: -1, noRefs: true }))
await Promise.all(inputs.map(name => unlink(join(releaseDir, name))))
console.log(`desktop mac update metadata merged: ${files.length} payload(s)`)

function isMetadata(value) {
  return typeof value === 'object' && value !== null && typeof value.version === 'string'
    && Array.isArray(value.files) && value.files.length > 0
    && value.files.every(file => typeof file === 'object' && file !== null
      && typeof file.url === 'string' && typeof file.sha512 === 'string' && typeof file.size === 'number')
}
