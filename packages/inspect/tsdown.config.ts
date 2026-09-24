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
    bridge: 'src/bridge.ts',
    vite: 'src/vite/index.ts',
    'vite/client': 'src/vite/client.ts'
  },
  external: ['@expressive/mvc', 'vite'],
  format: ['esm'],
  outputOptions: {
    exports: 'named'
  }
});
