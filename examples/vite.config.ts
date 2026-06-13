import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const src = (pkg: string, entry = 'index') =>
  fileURLToPath(new URL(`../packages/${pkg}/src/${entry}.ts`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Dev-only: resolve workspace packages to TS source for hot-reload sans `dist`.
  resolve: {
    alias: {
      '@common': fileURLToPath(new URL('./common', import.meta.url)),
      '@expressive/router': src('router'),
      '@expressive/react': src('react'),
      // Subpaths before the bare alias, which would otherwise prefix-rewrite them.
      '@expressive/mvc/jsx-runtime': src('mvc', 'jsx-runtime'),
      '@expressive/mvc/jsx-dev-runtime': src('mvc', 'jsx-dev-runtime'),
      '@expressive/mvc': src('mvc')
    }
  }
});
