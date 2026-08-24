import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const releaseDir = resolve('release')
await rm(releaseDir, { force: true, recursive: true })
console.log(`desktop release cleanup: removed ${releaseDir}`)
