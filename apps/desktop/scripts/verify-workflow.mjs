import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import yaml from 'js-yaml'

const path = resolve(import.meta.dirname, '../../../.github/workflows/desktop-release.yml')
const workflow = yaml.load(await readFile(path, 'utf8'))
const jobs = workflow?.jobs
if (!isRecord(jobs) || !isRecord(jobs.build) || !isRecord(jobs.publish)) fail('build and publish jobs are required')
assertPermissions(jobs.build.permissions, { contents: 'read', 'id-token': 'write', attestations: 'write' }, 'build')
assertPermissions(jobs.publish.permissions, { contents: 'write', 'id-token': 'write', attestations: 'write' }, 'publish')
if (jobs.build.environment !== 'desktop-signing') fail('build must use desktop-signing environment')
if (jobs.publish.environment !== 'desktop-production') fail('publish must use desktop-production environment')
if (jobs.build['timeout-minutes'] !== 60 || jobs.publish['timeout-minutes'] !== 20) fail('job timeouts must remain bounded')
const matrix = jobs.build.strategy?.matrix?.include
if (!Array.isArray(matrix)) fail('native release matrix is required')
const expected = new Set(['desktop-macos-arm64', 'desktop-macos-x64', 'desktop-windows-x64'])
for (const row of matrix) expected.delete(row?.artifact)
if (expected.size !== 0) fail(`release matrix is missing ${[...expected].join(', ')}`)
const source = await readFile(path, 'utf8')
for (const match of source.matchAll(/uses:\s+([^\s#]+)/g)) {
  if (!/@[0-9a-f]{40}$/.test(match[1])) fail(`action ${match[1]} must use an immutable commit SHA`)
}
const buildText = JSON.stringify(jobs.build)
if (buildText.includes('GH_TOKEN') || buildText.includes('GITHUB_TOKEN')) fail('build job must not receive repository write tokens')
const publishText = JSON.stringify(jobs.publish)
if (!publishText.includes('pnpm install --frozen-lockfile')) fail('publish must install the locked toolchain')
if (!publishText.includes('Attest final merged release assets')) fail('publish must attest the final merged release set')
if (!publishText.includes("'.assets | length'") || !publishText.includes('= 0')) fail('publish must require an empty target release')
if (publishText.includes('--clobber')) fail('publish must not overwrite existing release assets')
console.log('desktop release workflow policy verified')

function assertPermissions(actual, expected, job) {
  if (!isRecord(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) fail(`${job} permissions do not match least-privilege policy`)
}

function fail(message) {
  throw new Error(`desktop release workflow: ${message}`)
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
