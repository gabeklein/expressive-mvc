import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { configDefaults, mergeConfig } from 'vitest/config';

import { suite } from '../../vitest.config';

const preact = fileURLToPath(new URL('./', import.meta.url));
const react = fileURLToPath(new URL('../react/src/', import.meta.url));

// The react suite runs against this adapter: react imports resolve to
// preact/compat, and its `.` and `../test.setup` imports to this package.
// Bare imports resolve from this package, whose dependencies hold preact
// and its testing library under an isolated install.
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

for (const file of skipFiles)
  if (!existsSync(react + file))
    throw new Error(`react-suite: ${file} is not in packages/react/src`);

const tests = readdirSync(react, { recursive: true, encoding: 'utf8' })
  .filter((file) => /\.test\./.test(file) && !skipFiles.includes(file));

if (!tests.length)
  throw new Error('react-suite: no react tests to run');

export default mergeConfig(suite(true), {
  plugins: [
    {
      name: 'react-suite',
      enforce: 'pre',
      resolveId(id: string, importer?: string) {
        if (!importer?.startsWith(react)) return;
        if (/^\.\/?(index(\.tsx?)?)?$/.test(id)) return `${preact}src/index.ts`;
        if (id === '../test.setup') return `${preact}test.setup.ts`;
        if (id.startsWith('.') || id.startsWith('/')) return;

        return this.resolve(id, `${preact}src/index.ts`, { skipSelf: true });
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
    include: [`${react}**/*.test.*`],
    exclude: [...configDefaults.exclude, ...skipFiles.map((file) => react + file)]
  }
});
