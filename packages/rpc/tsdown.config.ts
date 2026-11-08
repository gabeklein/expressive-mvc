import { defineConfig } from 'tsdown';

const STRAY = new Set(['index.js', 'index.js.map', 'index.server.d.ts']);

export default defineConfig({
  clean: true,
  dts: { compilerOptions: { paths: {} } },
  sourcemap: true,
  outDir: 'dist',
  outExtensions: () => ({ js: '.js' }),
  entry: {
    index: 'src/index.ts',
    'index.server': 'src/server.ts',
    'index.client': 'src/client.ts',
    calls: 'src/calls.ts',
    http: 'src/http.ts',
    protocol: 'src/protocol.ts',
    vite: 'src/vite/index.ts'
  },
  platform: 'neutral',
  external: [/^node:/],
  format: ['esm'],
  plugins: [{
    name: 'stray',
    generateBundle(_, bundle) {
      for (const file of Object.keys(bundle)) if (STRAY.has(file)) delete bundle[file];
    }
  }],
  outputOptions: {
    exports: 'named',
    chunkFileNames: 'chunk-[name]-[hash].js'
  }
});
