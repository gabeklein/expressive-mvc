import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: true,
  sourcemap: true,
  outDir: 'dist',
  external: ['./runtime'],
  outExtensions: () => ({ js: '.js' }),
  entry: {
    index: 'src/index.ts',
    runtime: 'src/runtime.ts'
  },
  format: ['esm'],
  outputOptions: {
    exports: 'named'
  }
});
