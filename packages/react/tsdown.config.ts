import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: true,
  sourcemap: true,
  outDir: 'dist',
  external: ['./adapter'],
  outExtensions: () => ({ js: '.js' }),
  entry: {
    index: 'src/index.ts',
    adapter: 'src/adapter.ts'
  },
  format: ['esm'],
  outputOptions: {
    exports: 'named'
  }
});
