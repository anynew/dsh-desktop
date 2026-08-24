import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const tag = process.argv[2]
if (!tag) throw new Error('desktop release input: expected a dsh-v* tag')
const manifest = JSON.parse(await readFile(resolve(import.meta.dirname, '../package.json'), 'utf8'))
const expected = `dsh-v${manifest.version}`
if (tag !== expected) throw new Error(`desktop release input: tag ${JSON.stringify(tag)} must equal ${JSON.stringify(expected)}`)
const objectType = execFileSync('git', ['cat-file', '-t', tag], { encoding: 'utf8' }).trim()
if (objectType !== 'tag') throw new Error(`desktop release input: ${tag} must be an annotated tag, got ${objectType}`)
const tagCommit = execFileSync('git', ['rev-list', '-n', '1', tag], { encoding: 'utf8' }).trim()
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
if (tagCommit !== head) throw new Error(`desktop release input: ${tag} resolves to ${tagCommit}, but checkout is ${head}`)
console.log(`desktop release input verified: ${tag} at ${head}`)
