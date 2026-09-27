import { gzipSync } from 'bun';
import type { BunPlugin } from 'bun';
import { mkdirSync, rmSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { withWorkspaceLinks } from './workspace-links';

/**
 * Budgets are gzip bytes for one import shape, measured against built dist.
 * Per-shape rather than one aggregate: the point is to notice when the adapter's
 * irreducible floor grows, or when a formerly shakeable export stops shaking.
 *
 * Each carries ~3.5% headroom over the measured figure, because CI does not pin
 * a Bun version and minifier output drifts a little between them - measured at
 * <=0.5% across 1.3.1 and 1.3.14, so the margin is mostly slack. Real growth is
 * structural and clears it; toolchain drift does not. The react floor is the
 * exception: pinned to 9.1 kB, so ~1.9% - still above observed drift, but it
 * will flag sooner than the rest.
 */
const CASES = [
  {
    name: 'mvc: State only',
    limit: 5990,
    code: `import State from '@expressive/mvc'; console.log(State);`
  },
  {
    name: 'mvc: everything',
    limit: 9760,
    code: `import * as all from '@expressive/mvc'; console.log(all);`
  },
  {
    name: 'react: State only',
    limit: 9780,
    code: `import State from '@expressive/react'; console.log(State);`
  },
  {
    name: 'react: typical app',
    limit: 10570,
    code: `import State, { Component, get, set, ref, def } from '@expressive/react';
           console.log(State, Component, get, set, ref, def);`
  },
  {
    name: 'react: everything',
    limit: 12700,
    code: `import * as all from '@expressive/react'; console.log(all);`
  },
  {
    name: 'dom: renderer',
    limit: 16370,
    code: `import State, { Component, Context, def, get, has, map, pending, ref, set } from '@expressive/mvc';
           import { Consumer, Provider, createPortal, lazy, render } from '@expressive/dom';
           console.log(State, Component, Context, Consumer, Provider, createPortal, def, get, has, lazy, map, pending, ref, render, set);`
  },
  {
    name: 'dom: styling',
    limit: 18560,
    code: `import * as mvc from '@expressive/mvc';
           import * as dom from '@expressive/dom';
           console.log(mvc, dom);`
  },
  {
    name: 'router: everything',
    limit: 12800,
    code: `import * as all from '@expressive/router'; console.log(all);`
  },
  {
    name: 'inspect: install',
    limit: 10140,
    code: `import '@expressive/inspect/install';`
  },
  {
    name: 'react + router',
    limit: 16870,
    code: `import * as a from '@expressive/react';
           import * as b from '@expressive/router';
           console.log(a, b);`
  }
];

/**
 * Resolve `@expressive/*` through each package's exports map, the way a
 * consumer does. Without this, Bun applies the nearest package `tsconfig.json`
 * to files it processes - including a dependency's own `dist` - so an import of
 * `@expressive/mvc` alongside an adapter resolves once to `dist` and once to
 * `src`, and the probe measures two copies of the core.
 */
const published: BunPlugin = {
  name: 'published-exports',
  setup(build) {
    build.onResolve({ filter: /^@expressive\// }, async ({ path }) => {
      const [, name, ...rest] = path.split('/');
      const dir = resolve('packages', name);
      const manifest = await Bun.file(join(dir, 'package.json')).json();
      const key = rest.length ? `./${rest.join('/')}` : '.';
      const entry = manifest.exports?.[key]?.default ?? manifest.main;

      return { path: join(dir, entry) };
    });
  }
};

// Measured through bare specifiers, as a consumer writes them, so the exports
// map and each package's `sideEffects` both take part in the result.
const release = withWorkspaceLinks();

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
      plugins: [published],
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
  release();
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

// Advisory step (`continue-on-error`), so a breach cannot rely on a red check to
// be seen - the annotation reaches the PR's Checks tab, the table the run page.
if (over.length)
  console.log(
    `::warning title=Bundle size::` +
    over.map(({ name, bytes, limit }) =>
      `${name} is ${kb(bytes)}, over its ${kb(limit)} budget`).join('; ')
  );

if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## Bundle size',
      '',
      '| Import shape | gzip | budget |',
      '| --- | --- | --- |',
      ...results.map(({ name, bytes, limit }) =>
        `| ${name} | ${bytes > limit ? `**${kb(bytes)}** :warning:` : kb(bytes)} | ${kb(limit)} |`
      ),
      '',
      over.length
        ? `${over.length} shape(s) over budget. Advisory - raise budgets in \`.github/scripts/size-limit.ts\` if intended.`
        : 'All shapes within budget.',
      ''
    ].join('\n')
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
