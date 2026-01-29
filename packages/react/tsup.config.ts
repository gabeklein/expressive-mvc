import { defineConfig } from 'tsup';

export default defineConfig([
  {
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    external: ['./state', './jsx-runtime'],
    entry: {
      index: 'src/index.ts',
      state: 'src/state.ts',
      'jsx-runtime': 'src/jsx-runtime.ts',
      'jsx-dev-runtime': 'src/jsx-dev-runtime.ts'
    },
    format: ['cjs']
  },
  {
    sourcemap: true,
    outDir: 'dist/esm',
    external: ['./state', './jsx-runtime'],
    outExtension: () => ({ js: '.js' }),
    entry: {
      index: 'src/index.ts',
      state: 'src/state.ts',
      'jsx-runtime': 'src/jsx-runtime.ts',
      'jsx-dev-runtime': 'src/jsx-dev-runtime.ts'
    },
    format: ['esm']
  }
]);
