import { fileURLToPath } from 'node:url';
import { configDefaults, mergeConfig } from 'vitest/config';

import { suite } from '../../vitest.config';

const preact = fileURLToPath(new URL('./', import.meta.url));
const react = fileURLToPath(new URL('../react/src/', import.meta.url));

// The react suite runs against this adapter: react imports resolve to
// preact/compat, and its `.` and `../test.setup` imports to this package.
// React-only tests are marked in place (`reactOnly`, `preactDiffers`);
// whole files that don't apply are excluded here.

const skipFiles = [
  // react's own JSX host registration and vite plugin
  'jsx-runtime.test.tsx',
  'vite.test.ts',
  // instances and collections placed as children - preact rejects them
  'element.test.tsx',
  // react's ErrorBoundary; preact's has its own suite beside boundary.ts
  'boundary.test.tsx'
];

export default mergeConfig(suite(true), {
  plugins: [
    {
      name: 'react-suite',
      enforce: 'pre',
      resolveId(id: string, importer?: string) {
        if (!importer?.startsWith(react)) return;
        if (id === '.') return `${preact}src/index.ts`;
        if (id === '../test.setup') return `${preact}test.setup.ts`;
      }
    }
  ],
  resolve: {
    alias: [
      { find: /^react(-dom)?$/, replacement: 'preact/compat' },
      { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
      { find: /^react-dom\/server$/, replacement: 'preact-render-to-string' },
      { find: /^react\/jsx-(dev-)?runtime$/, replacement: 'preact/jsx-runtime' },
      { find: /^@testing-library\/react$/, replacement: '@testing-library/preact' }
    ]
  },
  test: {
    include: [`${react}*.test.*`],
    exclude: [...configDefaults.exclude, ...skipFiles.map((file) => react + file)]
  }
});
