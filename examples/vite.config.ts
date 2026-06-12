import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const src = (pkg: string, entry = 'index') =>
  fileURLToPath(new URL(`../packages/${pkg}/src/${entry}.ts`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Dev-only: resolve workspace packages to their TS source so edits hot-reload
  // without a `dist` rebuild. (Their package.json points at built `dist`.)
  resolve: {
    alias: {
      // Shared presentational chrome; the website loader rewrites this to a
      // relative `./common` folder when generating standalone sandboxes.
      '@common': fileURLToPath(new URL('./common', import.meta.url)),
      '@expressive/router': src('router'),
      '@expressive/react': src('react'),
      // Subpaths first - the bare alias would otherwise prefix-rewrite them
      // into `index.ts/jsx-runtime`.
      '@expressive/mvc/jsx-runtime': src('mvc', 'jsx-runtime'),
      '@expressive/mvc/jsx-dev-runtime': src('mvc', 'jsx-dev-runtime'),
      '@expressive/mvc': src('mvc')
    }
  }
});
