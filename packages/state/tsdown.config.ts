import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: true,
  entry: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/mocks.ts'],
  format: ['esm'],
  outDir: 'dist',
  outExtensions: () => ({ js: '.js' }),
  sourcemap: true,
  unbundle: true,
  outputOptions: {
    exports: 'named'
  }
});
