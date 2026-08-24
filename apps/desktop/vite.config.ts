import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { clientBuildEnvironmentDefines } from '../../scripts/client-build-environment.ts'

export default defineConfig({
  base: '/',
  plugins: [
    {
      name: 'desktop-safe-loader-config',
      enforce: 'pre',
      transform(code, id) {
        if (!id.endsWith('/vendor/loader/lib/index.js')) return
        const marker = '/** Recursively replace YAML `!js` expression nodes with evaluated values. */'
        const start = code.indexOf('const evaluate = new Function(')
        const end = code.indexOf(marker, start)
        if (start < 0 || end < 0) throw new Error('desktop build could not replace the Loader expression evaluator')
        return {
          code: `${code.slice(0, start)}const evaluate = (_ctx, _expr) => { throw new Error('desktop renderer does not support JavaScript loader expressions') };\n${code.slice(end)}`,
          map: null,
        }
      },
    },
    react(),
  ],
  build: {
    sourcemap: true,
    outDir: 'dist',
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: /^node:module$/,
        replacement: fileURLToPath(new URL('./src/node-module-stub.ts', import.meta.url)),
      },
    ],
  },
  define: {
    ...clientBuildEnvironmentDefines(process.env),
    'process.versions.node': '"0.0.0"',
    'process.execArgv': '[]',
    'process.env.CORDIS_SHARED': 'undefined',
  },
})
