import { gzipSync } from 'bun';
import { existsSync, mkdirSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Budgets are min+gzip bytes for one import shape, measured against built dist.
 * Per-shape rather than one aggregate: the point is to notice when the adapter's
 * irreducible floor grows, or when a formerly shakeable export stops shaking.
 *
 * Each carries ~3.5% headroom over the measured figure, because CI does not pin
 * a Bun version and minifier output drifts a little between them - measured at
 * <=0.5% across 1.3.1 and 1.3.14, so the margin is mostly slack. Real growth is
 * structural and clears it; toolchain drift does not.
 */
const CASES = [
  {
    name: 'mvc: State only',
    limit: 4900,
    code: `import State from '@expressive/mvc'; console.log(State);`
  },
  {
    name: 'mvc: everything',
    limit: 8450,
    code: `import * as all from '@expressive/mvc'; console.log(all);`
  },
  {
    name: 'react: State only',
    limit: 8100,
    code: `import State from '@expressive/react'; console.log(State);`
  },
  {
    name: 'react: typical app',
    limit: 8750,
    code: `import State, { Component, get, set, ref, def } from '@expressive/react';
           console.log(State, Component, get, set, ref, def);`
  },
  {
    name: 'react: everything',
    limit: 11100,
    code: `import * as all from '@expressive/react'; console.log(all);`
  },
  {
    name: 'router: everything',
    limit: 10700,
    code: `import * as all from '@expressive/router'; console.log(all);`
  },
  {
    name: 'react + router',
    limit: 14600,
    code: `import * as a from '@expressive/react';
           import * as b from '@expressive/router';
           console.log(a, b);`
  }
];

/**
 * Measure through bare specifiers, as a consumer writes them, so the exports
 * map and each package's `sideEffects` both take part. That needs
 * `node_modules/@expressive/*` present, which the runner's bun does not always
 * link for workspace packages - so guarantee it here rather than assume it.
 * Only links this script creates are removed afterward.
 */
const PACKAGES = ['mvc', 'react', 'router'];
const scope = join('node_modules', '@expressive');
const linked: string[] = [];

mkdirSync(scope, { recursive: true });

for (const name of PACKAGES) {
  const link = join(scope, name);

  if (!existsSync(link)) {
    symlinkSync(resolve('packages', name), link, 'junction');
    linked.push(link);
  }
}

if (linked.length)
  console.log(`Linked for measurement: ${linked.join(', ')}\n`);

const dir = '.size-probe';
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
  for (const link of linked) unlinkSync(link);
}

const kb = (n: number) => (n / 1024).toFixed(2) + ' kB';
const over = results.filter(({ bytes, limit }) => bytes > limit);
const stale = results.filter(({ bytes, limit }) => bytes < limit * 0.85);

for (const { name, bytes, limit } of results) {
  const mark = bytes > limit ? 'FAIL' : bytes < limit * 0.85 ? 'slack' : 'ok';
  console.log(`${name.padEnd(24)} ${kb(bytes).padStart(9)} / ${kb(limit).padStart(9)}  ${mark}`);
}

await Bun.write(
  'size-report.json',
  JSON.stringify(Object.fromEntries(results.map(({ name, bytes }) => [name, bytes])), null, 2)
);

if (stale.length)
  console.log(
    `\nBudgets exceed measured size by >15% (${stale.map(({ name }) => name).join(', ')}).` +
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
