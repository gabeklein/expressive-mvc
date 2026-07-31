import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const packages = fileURLToPath(new URL('packages/', import.meta.url));

export function suite(dom?: boolean) {
  return defineConfig({
    resolve: {
      alias: [
        { find: /^@expressive\/([^/]+)$/, replacement: `${packages}$1/src` },
        { find: /^@expressive\/([^/]+)\/(.+)$/, replacement: `${packages}$1/src/$2` }
      ]
    },
    test: {
      include: ['src/**/*.test.*'],
      setupFiles: ['./test.setup.ts'],
      ...(dom && {
        environment: 'happy-dom',
        environmentOptions: { happyDOM: { url: 'http://localhost/' } }
      }),
      coverage: {
        provider: 'istanbul',
        include: ['src/**'],
        reporter: ['text-summary', 'lcov'],
        thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
      }
    }
  });
}
