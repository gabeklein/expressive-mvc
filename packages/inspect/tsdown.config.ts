import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: true,
  sourcemap: true,
  outDir: 'dist',
  outExtensions: () => ({ js: '.js' }),
  entry: {
    index: 'src/index.ts',
    install: 'src/install.ts',
    playwright: 'src/playwright.ts'
  },
  external: ['@expressive/mvc'],
  format: ['esm'],
  outputOptions: {
    exports: 'named'
  }
});
