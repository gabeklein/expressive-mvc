import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: true,
  sourcemap: true,
  outDir: 'dist',
  outExtensions: () => ({ js: '.js' }),
  entry: {
    index: 'src/index.ts',
    adapter: 'src/adapter.ts',
    'jsx-runtime': 'src/jsx-runtime.ts',
    'jsx-dev-runtime': 'src/jsx-dev-runtime.ts'
  },
  format: ['esm'],
  outputOptions: {
    exports: 'named',
    chunkFileNames: 'chunk-[name]-[hash].js'
  }
});
