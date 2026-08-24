import { defineConfig } from 'tsdown'

const shared = {
  outDir: 'lib',
  platform: 'node' as const,
  target: 'es2024' as const,
  dts: false,
  clean: false,
}

export default defineConfig([
  {
    ...shared,
    entry: ['lib/types/main.js'],
    format: ['esm'],
    fixedExtension: false,
    deps: { neverBundle: ['electron'] },
  },
  {
    ...shared,
    entry: { preload: 'lib/types/preload.js' },
    format: ['cjs'],
    fixedExtension: true,
    deps: { alwaysBundle: [/^\.\//], neverBundle: ['electron'] },
  },
])
