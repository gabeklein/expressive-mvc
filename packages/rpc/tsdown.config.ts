import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: { compilerOptions: { paths: {} } },
  sourcemap: true,
  outDir: 'dist',
  outExtensions: () => ({ js: '.js' }),
  entry: {
    index: 'src/index.ts',
    protocol: 'src/protocol.ts',
    'protocol/vite': 'src/protocol/vite.ts',
    http: 'src/http.ts',
    'http.server': 'src/http/server.ts',
    'http.client': 'src/http/client.ts',
    vite: 'src/vite/index.ts'
  },
  platform: 'neutral',
  external: [/^node:/],
  format: ['esm'],
  outputOptions: {
    exports: 'named',
    chunkFileNames: 'chunk-[name]-[hash].js'
  }
});
