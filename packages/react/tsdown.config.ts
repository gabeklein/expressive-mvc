import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: true,
  sourcemap: true,
  outDir: 'dist',
  external: ['./state'],
  outExtensions: () => ({ js: '.js' }),
  entry: {
    index: 'src/index.ts',
    state: 'src/state.ts'
  },
  format: ['esm'],
  outputOptions: {
    exports: 'named'
  }
});
