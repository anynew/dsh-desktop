import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import yaml from 'js-yaml'

const releaseDir = resolve(process.argv[2] ?? 'release')
const manifest = JSON.parse(await readFile(resolve(import.meta.dirname, '../package.json'), 'utf8'))
const names = (await readdir(releaseDir, { withFileTypes: true }))
  .filter(entry => entry.isFile())
  .map(entry => entry.name)
  .sort()
const allPlatforms = process.argv.includes('--all-platforms')
const metadataName = process.platform === 'darwin' ? 'latest-mac.yml' : process.platform === 'win32' ? 'latest.yml' : undefined
if (!allPlatforms && metadataName === undefined) throw new Error(`desktop release assets: unsupported platform ${process.platform}`)
if (allPlatforms) {
  await verifyMetadata('latest-mac.yml')
  await verifyMetadata('latest.yml')
  console.log('desktop release assets verified: merged macOS and Windows metadata')
  process.exit(0)
}
await verifyMetadata(metadataName)

async function verifyMetadata(metadataName) {
const metadata = yaml.load(await readFile(join(releaseDir, metadataName), 'utf8'))
if (!isRecord(metadata) || !Array.isArray(metadata.files) || metadata.files.length === 0) {
  throw new Error(`desktop release assets: ${metadataName} has no update files`)
}
if (metadata.version !== manifest.version) {
  throw new Error(`desktop release assets: ${metadataName} version ${JSON.stringify(metadata.version)} must equal ${JSON.stringify(manifest.version)}`)
}
for (const file of metadata.files) {
  if (!isRecord(file) || typeof file.url !== 'string' || typeof file.sha512 !== 'string' || typeof file.size !== 'number') {
    throw new Error(`desktop release assets: ${metadataName} contains an invalid file row`)
  }
  const path = join(releaseDir, basename(file.url))
  const actualSize = (await stat(path)).size
  const actualHash = await digest(path)
  if (actualSize !== file.size) throw new Error(`desktop release assets: size mismatch for ${file.url}`)
  if (actualHash !== file.sha512) throw new Error(`desktop release assets: SHA-512 mismatch for ${file.url}`)
}
const required = metadataName === 'latest-mac.yml'
  ? [/\.dmg$/, /\.zip$/]
  : [/\.exe$/, /\.exe\.blockmap$/]
for (const pattern of required) {
  if (!names.some(name => pattern.test(name))) throw new Error(`desktop release assets: missing ${pattern} artifact`)
}
console.log(`desktop release assets verified: ${metadata.files.length} signed update payload(s) in ${metadataName}`)
}

async function digest(path) {
  const hash = createHash('sha512')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('base64')
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
