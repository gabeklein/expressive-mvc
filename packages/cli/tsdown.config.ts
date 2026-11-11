import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: { compilerOptions: { paths: {} } },
  sourcemap: true,
  outDir: 'dist',
  outExtensions: () => ({ js: '.js' }),
  entry: {
    index: 'src/index.ts',
    bin: 'src/bin.ts'
  },
  format: ['esm'],
  outputOptions: {
    exports: 'named'
  }
});
