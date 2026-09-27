import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const examples = fileURLToPath(new URL('..', import.meta.url));
const packages = fileURLToPath(new URL('../../packages/', import.meta.url));

const alias = [
  { find: /^@common-dom\//, replacement: `${examples}common-dom/` },
  { find: /^@common\//, replacement: `${examples}common/` },
  { find: /^@expressive\/([^/]+)$/, replacement: `${packages}$1/src` },
  { find: /^@expressive\/([^/]+)\/(.+)$/, replacement: `${packages}$1/src/$2` }
];

const project = (name: 'react' | 'dom') => ({
  root: examples,
  resolve: { alias },
  test: {
    name,
    include: ['smoke/**/*.test.ts'],
    setupFiles: ['smoke/setup.ts'],
    environment: 'happy-dom',
    environmentOptions: { happyDOM: { url: 'http://localhost/' } },
    env: { RENDERER: name },
    testTimeout: 10000
  }
});

export default defineConfig({
  test: { projects: [project('react'), project('dom')] }
});
