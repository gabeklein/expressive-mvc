import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const packages = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@expressive\/([^/]+)$/, replacement: `${packages}$1/src` },
      { find: /^@expressive\/([^/]+)\/(.+)$/, replacement: `${packages}$1/src/$2` }
    ]
  },
  test: {
    include: ['src/**/*.test.*'],
    setupFiles: ['./test.dom.ts', './test.setup.ts'],
    coverage: {
      provider: 'istanbul',
      include: ['src/**'],
      reporter: ['text-summary', 'lcov']
    }
  }
});
