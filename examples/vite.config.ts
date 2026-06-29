import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

  // Aliasing each `src` dir (not its index) lets prefix-rewrite resolve subpaths
  // like `@expressive/mvc/observable` too.
const src = (pkg: string) =>
  fileURLToPath(new URL(`../packages/${pkg}/src`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Dev-only: resolve workspace packages to TS source for hot-reload sans `dist`.
  resolve: {
    alias: {
      '@common': fileURLToPath(new URL('./common', import.meta.url)),
      '@expressive/router': src('router'),
      '@expressive/react': src('react'),
      '@expressive/mvc': src('mvc')
    }
  }
});
