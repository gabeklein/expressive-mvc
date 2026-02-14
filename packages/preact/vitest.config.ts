import { defineConfig } from 'vitest/config';
import path from 'node:path';
const root = __dirname;

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['../../vitest.setup.ts'],
    alias: {
      '@expressive/mvc': path.resolve(root, '../mvc/src'),
      '@expressive/react/state': path.resolve(root, '../react/src/state.ts'),
      react: path.resolve(root, 'node_modules/preact/compat/dist/compat.module.js'),
      'react-dom': path.resolve(
        root,
        'node_modules/preact/compat/dist/compat.module.js'
      ),
      'react/jsx-runtime': path.resolve(
        root,
        'node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js'
      ),
      'react/jsx-dev-runtime': path.resolve(
        root,
        'node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js'
      )
    },
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/index.ts'],
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
      react: path.resolve(root, 'node_modules/preact/compat/dist/compat.module.js'),
      'react-dom': path.resolve(
        root,
        'node_modules/preact/compat/dist/compat.module.js'
      ),
      'react/jsx-runtime': path.resolve(
        root,
        'node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js'
      ),
      'react/jsx-dev-runtime': path.resolve(
        root,
        'node_modules/preact/jsx-runtime/dist/jsxRuntime.module.js'
      )
    }
  }
});
