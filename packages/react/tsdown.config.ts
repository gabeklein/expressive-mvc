import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    external: ['./state'],
    outExtensions: () => ({ js: '.js' }),
    entry: {
      index: 'src/index.ts',
      state: 'src/state.ts'
    },
    format: ['cjs'],
    outputOptions: {
      exports: 'named'
    }
  },
  {
    sourcemap: true,
    unbundle: true,
    outDir: 'dist/esm',
    external: ['./state'],
    dts: false,
    outExtensions: () => ({ js: '.js' }),
    format: ['esm'],
    entry: {
      index: 'src/index.ts',
      state: 'src/state.ts'
    },
    outputOptions: {
      exports: 'named'
    }
  }
]);
