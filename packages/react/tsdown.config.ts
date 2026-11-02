import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: { compilerOptions: { paths: {} } },
  sourcemap: true,
  outDir: 'dist',
  outExtensions: () => ({ js: '.js' }),
  entry: {
    index: 'src/index.ts',
    adapter: 'src/adapter.ts',
    vite: 'src/vite.ts'
  },
  format: ['esm'],
  outputOptions: {
    exports: 'named',
    chunkFileNames: 'chunk-[name]-[hash].js'
  }
});
