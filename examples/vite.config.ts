import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const src = (pkg: string) =>
  fileURLToPath(new URL(`../packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Dev-only: resolve workspace packages to their TS source so edits hot-reload
  // without a `dist` rebuild. (Their package.json points at built `dist`.)
  resolve: {
    alias: {
      '@expressive/router': src('router'),
      '@expressive/react': src('react'),
      '@expressive/mvc': src('mvc')
    }
  }
});
