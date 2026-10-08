import { fileURLToPath } from 'node:url';
import { configDefaults, mergeConfig } from 'vitest/config';

import { suite } from '../../vitest.config';

const preact = fileURLToPath(new URL('./', import.meta.url));
const react = fileURLToPath(new URL('../react/src/', import.meta.url));

// The react suite runs against this adapter: react imports resolve to
// preact/compat, and its `.` and `../test.setup` imports to this package.
// What follows is the React-only remainder.

const skipFiles = [
  // react's own JSX host registration and vite plugin
  'jsx-runtime.test.tsx',
  'vite.test.ts',
  // instances and collections placed as children - preact rejects them
  'element.test.tsx',
  // react's ErrorBoundary; preact's has its own suite beside boundary.ts
  'boundary.test.tsx'
];

const skipTests = [
  // concurrent rendering: startTransition, useSyncExternalStore, Activity
  'will transition',
  'mixed revisions',
  '^pending ',
  // StrictMode double invocation - preact/compat StrictMode is a passthrough
  'strict mode will (construct twice|survive define-semantics)',
  // react-refresh
  'fast refresh',
  // preact keeps a class-instance ref populated after unmount
  'ref prop will populate ref object',
  // preact flushes the subscription refresh before the assertion
  'props property will not cause redundant render',
  // preact lands an async refresh a tick later
  'State.get async ',
  'State.get set instruction factory ',
  // compat Suspense cannot hand a suspension to a boundary added later
  'Provider suspense will ignore suspense if undefined'
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
    exclude: [...configDefaults.exclude, ...skipFiles.map((file) => react + file)],
    testNamePattern: new RegExp(`^(?!.*(${skipTests.join('|')}))`)
  }
});
