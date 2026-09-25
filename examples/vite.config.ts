import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import inspect from '../packages/inspect/src/vite';

  // Aliasing each `src` dir (not its index) lets prefix-rewrite resolve subpaths
  // like `@expressive/mvc/observable` too.
const src = (pkg: string) =>
  fileURLToPath(new URL(`../packages/${pkg}/src`, import.meta.url));

export default defineConfig({
  plugins: [react(), inspect()],
  // Dev-only: resolve workspace packages to TS source for hot-reload sans `dist`.
  resolve: {
    alias: {
      '@common': fileURLToPath(new URL('./common', import.meta.url)),
      '@expressive/inspect': src('inspect'),
      '@expressive/router': src('router'),
      '@expressive/react': src('react'),
      '@expressive/mvc': src('mvc')
    }
  }
});
