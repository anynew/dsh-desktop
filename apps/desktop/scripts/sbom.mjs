import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../../..')
const manifest = JSON.parse(await readFile(resolve(root, 'apps/desktop/package.json'), 'utf8'))
const lock = await readFile(resolve(root, 'pnpm-lock.yaml'))
const components = Object.keys(manifest.dependencies ?? {}).sort().map(name => ({
  type: name.startsWith('@deepseek-ai/') ? 'library' : 'library',
  name,
  version: manifest.dependencies[name],
  'bom-ref': `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(manifest.dependencies[name])}`,
}))
const bom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.6',
  serialNumber: `urn:uuid:${stableUuid(lock)}`,
  version: 1,
  metadata: {
    component: {
      type: 'application',
      name: manifest.name,
      version: manifest.version,
    },
    properties: [{ name: 'deepseek-harness:pnpm-lock-sha256', value: createHash('sha256').update(lock).digest('hex') }],
  },
  components,
}
await writeFile(resolve(root, 'apps/desktop/release/sbom.cdx.json'), JSON.stringify(bom, null, 2) + '\n')

function stableUuid(bytes) {
  const hex = createHash('sha256').update(bytes).digest('hex').slice(0, 32).split('')
  hex[12] = '5'
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)
  const joined = hex.join('')
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`
}
