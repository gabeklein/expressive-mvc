import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['../../vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/index.ts', 'dist'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100
      }
    }
  },
  resolve: {
    alias: {
      '@expressive/mvc': '../../mvc/src',
      '@expressive/react': '../../react/src',
      '@expressive/react/state': '../../react/src/state'
    }
  }
});
