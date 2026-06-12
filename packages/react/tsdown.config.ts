import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: true,
  sourcemap: true,
  outDir: 'dist',
  external: ['./state', './jsx-runtime'],
  outExtensions: () => ({ js: '.js' }),
  entry: {
    index: 'src/index.ts',
    state: 'src/state.ts',
    'jsx-runtime': 'src/jsx-runtime.ts',
    'jsx-dev-runtime': 'src/jsx-dev-runtime.ts'
  },
  format: ['esm'],
  outputOptions: {
    exports: 'named'
  }
});
