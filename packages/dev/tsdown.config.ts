import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  dts: { compilerOptions: { paths: {} } },
  sourcemap: true,
  outDir: 'dist',
  outExtensions: () => ({ js: '.js' }),
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    'vite/index': 'src/vite/index.ts',
    'server/index': 'src/server/index.ts'
  },
  platform: 'node',
  format: ['esm'],
  outputOptions: {
    exports: 'named',
    chunkFileNames: 'chunk-[name]-[hash].js'
  }
});
