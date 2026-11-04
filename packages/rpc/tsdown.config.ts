import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: { compilerOptions: { paths: {} } },
  sourcemap: true,
  outDir: 'dist',
  outExtensions: () => ({ js: '.js' }),
  entry: {
    index: 'src/index.ts',
    internal: 'src/internal.ts',
    http: 'src/http.ts',
    'http.server': 'src/http/server.ts',
    'http.client': 'src/http/client.ts'
  },
  platform: 'neutral',
  format: ['esm'],
  outputOptions: {
    exports: 'named',
    chunkFileNames: 'chunk-[name]-[hash].js'
  }
});
