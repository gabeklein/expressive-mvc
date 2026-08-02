import { gzipSync } from 'bun';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Budgets are min+gzip bytes for one import shape, measured against built dist.
 * Per-shape rather than one aggregate: the point is to notice when the adapter's
 * irreducible floor grows, or when a formerly shakeable export stops shaking.
 */
const CASES = [
  {
    name: 'mvc: State only',
    limit: 4800,
    code: `import State from '@expressive/mvc'; console.log(State);`
  },
  {
    name: 'mvc: everything',
    limit: 8200,
    code: `import * as all from '@expressive/mvc'; console.log(all);`
  },
  {
    name: 'react: State only',
    limit: 7900,
    code: `import State from '@expressive/react'; console.log(State);`
  },
  {
    name: 'react: typical app',
    limit: 8500,
    code: `import State, { Component, get, set, ref, def } from '@expressive/react';
           console.log(State, Component, get, set, ref, def);`
  },
  {
    name: 'react: everything',
    limit: 10700,
    code: `import * as all from '@expressive/react'; console.log(all);`
  },
  {
    name: 'router: everything',
    limit: 10300,
    code: `import * as all from '@expressive/router'; console.log(all);`
  },
  {
    name: 'react + router',
    limit: 14100,
    code: `import * as a from '@expressive/react';
           import * as b from '@expressive/router';
           console.log(a, b);`
  }
];

// Inside the workspace so bare specifiers resolve through node_modules.
const dir = 'node_modules/.size-probe';
mkdirSync(dir, { recursive: true });

const results: { name: string; bytes: number; limit: number }[] = [];

try {
  for (const probe of CASES) {
    const entry = join(dir, probe.name.replace(/[^a-z0-9]+/gi, '-') + '.ts');
    await Bun.write(entry, probe.code);

    const built = await Bun.build({
      entrypoints: [entry],
      minify: true,
      target: 'browser',
      format: 'esm',
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      define: { 'process.env.NODE_ENV': '"production"' }
    });

    if (!built.success)
      throw new AggregateError(built.logs, `Failed to bundle "${probe.name}".`);

    const source = await built.outputs[0].text();
    const bytes = gzipSync(Buffer.from(source), { level: 9 }).length;

    results.push({ name: probe.name, bytes, limit: probe.limit });
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const kb = (n: number) => (n / 1024).toFixed(2) + ' kB';
const over = results.filter(({ bytes, limit }) => bytes > limit);
const stale = results.filter(({ bytes, limit }) => bytes < limit - 1024);

for (const { name, bytes, limit } of results) {
  const mark = bytes > limit ? 'FAIL' : bytes < limit - 1024 ? 'under' : 'ok';
  console.log(`${name.padEnd(24)} ${kb(bytes).padStart(9)} / ${kb(limit).padStart(9)}  ${mark}`);
}

await Bun.write(
  'size-report.json',
  JSON.stringify(Object.fromEntries(results.map(({ name, bytes }) => [name, bytes])), null, 2)
);

if (stale.length)
  console.log(
    `\nBudgets exceed measured size by >1 kB (${stale.map(({ name }) => name).join(', ')}).` +
    ` Tighten them so the gate keeps its teeth.`
  );

if (over.length)
  throw new Error(
    `Bundle size regressed:\n` +
    over.map(({ name, bytes, limit }) =>
      `  ${name}: ${kb(bytes)} exceeds budget ${kb(limit)}`).join('\n') +
    `\n\nIf the growth is intended, raise the budget in .github/scripts/size-limit.ts` +
    ` and update the figures quoted in docs (see website/content/docs/guides/bundle-size.mdx).`
  );

console.log('\nAll import shapes within budget.');
