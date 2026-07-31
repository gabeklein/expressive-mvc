import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    setupFiles: ['./test.setup.ts'],
    coverage: {
      provider: 'istanbul',
      include: ['src/**'],
      reporter: ['text-summary', 'lcov'],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 }
    }
  }
});
