import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const examples = fileURLToPath(new URL('..', import.meta.url));
const stack = process.env.STACK!;

export default defineConfig({
  root: examples,
  esbuild: { jsx: 'automatic', jsxImportSource: '@expressive/dom' },
  resolve: {
    alias: [
      { find: /^@common-dom\//, replacement: `${examples}common-dom/` },
      { find: /^@expressive\/([^/]+)$/, replacement: `${stack}/packages/$1/src` },
      { find: /^@expressive\/([^/]+)\/(.+)$/, replacement: `${stack}/packages/$1/src/$2` }
    ]
  }
});
