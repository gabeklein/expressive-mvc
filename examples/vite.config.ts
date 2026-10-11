import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import inspect from '../packages/inspect/src/vite';
import domHot from '../packages/dom/src/vite';
import reactHot from '../packages/react/src/vite';

  // Aliasing each `src` dir (not its index) lets prefix-rewrite resolve subpaths
  // like `@expressive/mvc/observable` too.
const src = (pkg: string) =>
  fileURLToPath(new URL(`../packages/${pkg}/src`, import.meta.url));

// `--mode dom` serves example frames (dom.html) on @expressive/dom: pages compile
// against its JSX runtime and any `@expressive/react` import resolves to dom.
// The React shell is not served there.
export default defineConfig(({ mode }) => {
  const dom = mode == 'dom';

  return {
    cacheDir: dom ? 'node_modules/.vite-dom' : undefined,
    optimizeDeps: dom ? { entries: ['dom.html'] } : undefined,
    plugins: dom ? [inspect(), domHot()] : [react(), inspect(), reactHot()],
    esbuild: dom ? { jsx: 'automatic', jsxImportSource: '@expressive/dom' } : undefined,
    // Dev-only: resolve workspace packages to TS source for hot-reload sans `dist`.
    resolve: {
      alias: {
        '@common': fileURLToPath(new URL('./common', import.meta.url)),
        '@expressive/inspect': src('inspect'),
        '@expressive/router': src('router'),
        '@expressive/react': src(dom ? 'dom' : 'react'),
        '@expressive/dom': src('dom'),
        '@expressive/mvc': src('mvc')
      }
    }
  };
});
