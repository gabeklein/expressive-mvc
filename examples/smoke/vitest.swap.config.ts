import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const examples = fileURLToPath(new URL('..', import.meta.url));
const source = process.env.SOURCE!;
const packages = `${source}/../packages/`;

const project = (name: 'react' | 'dom') => ({
  root: examples,
  esbuild: { jsx: 'automatic' as const, jsxImportSource: name == 'dom' ? '@expressive/dom' : 'react' },
  resolve: {
    alias: [
      { find: /^@swap\//, replacement: `${source}/` },
      { find: /^react-dom(\/.*)?$/, replacement: `${source}/../node_modules/react-dom$1` },
      { find: /^react(\/.*)?$/, replacement: `${source}/../node_modules/react$1` },
      { find: /^@common\//, replacement: `${source}/common/` },
      ...(name == 'dom' ? [{ find: /^@expressive\/react$/, replacement: `${packages}dom/src` }] : []),
      { find: /^@expressive\/([^/]+)$/, replacement: `${packages}$1/src` },
      { find: /^@expressive\/([^/]+)\/(.+)$/, replacement: `${packages}$1/src/$2` }
    ]
  },
  test: {
    name,
    include: ['smoke/**/*.test.ts'],
    setupFiles: ['smoke/setup.ts'],
    environment: 'happy-dom',
    environmentOptions: { happyDOM: { url: 'http://localhost/' } },
    env: { RENDERER: name, SWAP: '1' },
    testTimeout: 10000
  }
});

export default defineConfig({ test: { projects: [project('react'), project('dom')] } });
