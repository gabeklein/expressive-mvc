import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Pack every publishable package, install the tarballs into a throwaway project
 * outside the repo, and execute the result under native Node ESM. Nothing else
 * in CI resolves the built dist the way a consumer does: vitest aliases the
 * scope onto sources, and `npm publish --dry-run` runs no code at all.
 */
const PACKAGES = ['mvc', 'react', 'router'];

const PROBES: Record<string, string> = {
  mvc: `
import assert from 'node:assert/strict';
import State from '@expressive/mvc';

class Store extends State {
  count = 0;
  get double() { return this.count * 2 }
}

const store = Store.new();
const seen = [];

store.get(({ count }) => { seen.push(count) });

store.count = 2;

const update = await store.set();

assert.deepEqual(update, ['count']);
assert.equal(store.double, 4);
assert.deepEqual(seen, [0, 2]);

store.set(null);

console.log('mvc: State round-trip ok');
`,
  react: `
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import State, { Component, Provider, Consumer, get, set, ref, def, has, map } from '@expressive/react';

for (const [name, value] of Object.entries({ State, Component, Provider, Consumer, get, set, ref, def, has, map }))
  assert.equal(typeof value, 'function', name + ' is not exported by the built dist');

class Counter extends State {
  value = 5;
}

const View = () => createElement('span', null, Counter.use().value);

assert.equal(renderToStaticMarkup(createElement(View)), '<span>5</span>');

class Widget extends Component {
  label = 'unset';

  render() {
    return createElement('b', null, this.label);
  }
}

assert.equal(
  renderToStaticMarkup(createElement(Widget, { label: 'patched' })),
  '<b>patched</b>'
);

console.log('react: hook render + Component render ok');
`,
  router: `
import assert from 'node:assert/strict';
import { Router, BrowserRouter, Route, Link, Redirect, NavLinks, matchPattern } from '@expressive/router';

for (const [name, value] of Object.entries({ Router, BrowserRouter, Route, Link, Redirect, NavLinks, matchPattern }))
  assert.equal(typeof value, 'function', name + ' is not exported by the built dist');

assert.deepEqual(matchPattern('/user/:id', '/user/42').params, { id: '42' });

console.log('router: import shape ok');
`
};

function run(cmd: string[], cwd: string) {
  const { exitCode, stdout, stderr } = Bun.spawnSync(cmd, { cwd, stdout: 'pipe', stderr: 'pipe' });
  const out = stdout.toString();
  const err = stderr.toString();

  if (exitCode !== 0)
    throw new Error(`\`${cmd.join(' ')}\` failed in ${cwd}:\n${out}\n${err}`);

  return out;
}

const fixture = mkdtempSync(join(tmpdir(), 'expressive-dist-smoke-'));
const tarballs: Record<string, string> = {};

try {
  for (const name of PACKAGES) {
    const packed = run(
      ['npm', 'pack', '--json', '--pack-destination', fixture],
      resolve('packages', name)
    );
    const [{ filename }] = JSON.parse(packed);

    tarballs[`@expressive/${name}`] = `file:./${filename}`;
    console.log(`packed @expressive/${name} -> ${filename}`);
  }

  writeFileSync(
    join(fixture, 'package.json'),
    JSON.stringify(
      {
        name: 'dist-smoke',
        version: '0.0.0',
        private: true,
        type: 'module',
        dependencies: { ...tarballs, react: '^19', 'react-dom': '^19' },
        overrides: tarballs
      },
      null,
      2
    )
  );

  run(['npm', 'install', '--no-audit', '--no-fund', '--loglevel=error'], fixture);

  for (const [name, source] of Object.entries(PROBES)) {
    const probe = `probe.${name}.mjs`;

    writeFileSync(join(fixture, probe), source);
    process.stdout.write(run(['node', probe], fixture));
  }
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

console.log('\nPublished dist imports and executes under Node ESM.');
