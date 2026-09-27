import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * Pack every publishable package, install the tarballs into a throwaway project
 * outside the repo, and execute the result under native Node ESM. Nothing else
 * in CI resolves the built dist the way a consumer does: vitest aliases the
 * scope onto sources, and `npm publish --dry-run` runs no code at all.
 *
 * Runs from `ci:publish`, so it gates the publish itself rather than every merge.
 */
const PACKAGES = ['mvc', 'react', 'dom', 'router', 'inspect'];

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
  dom: `
import assert from 'node:assert/strict';
import State, { Component } from '@expressive/mvc';
import { Consumer, Provider, createPortal, lazy, macro, render, style } from '@expressive/dom';
import { jsx, jsxs } from '@expressive/dom/jsx-runtime';
import { jsxDEV } from '@expressive/dom/jsx-dev-runtime';

for (const [name, value] of Object.entries({ State, Component, Consumer, Provider, createPortal, lazy, macro, render, style, jsx, jsxs, jsxDEV }))
  assert.equal(typeof value, 'function', name + ' is not exported by the built dist');

assert.equal(jsx('div', { children: 'ready' }).type, 'div');

console.log('dom: import shape ok');
`,
  router: `
import assert from 'node:assert/strict';
import { Router, BrowserRouter, Route, Link, Redirect, NavLinks, matchPattern } from '@expressive/router';

for (const [name, value] of Object.entries({ Router, BrowserRouter, Route, Link, Redirect, NavLinks, matchPattern }))
  assert.equal(typeof value, 'function', name + ' is not exported by the built dist');

assert.deepEqual(matchPattern('/user/:id', '/user/42').params, { id: '42' });

console.log('router: import shape ok');
`,
  inspect: `
import assert from 'node:assert/strict';
import '@expressive/inspect/install';
import State from '@expressive/mvc';
import { find, journal } from '@expressive/inspect';
import { inspect } from '@expressive/inspect/bridge';
import vite from '@expressive/inspect/vite';

class Composer extends State {
  draft = '';
  submit(text) { this.draft = text }
}

const composer = Composer.new();
const page = { evaluate: async (fn, arg) => fn(arg) };
const api = inspect(page);

assert.equal(typeof globalThis.__EXPRESSIVE_INSPECT__, 'object');
assert.equal(await api.get('Composer.draft'), '');

const frames = await find('Composer').act((s) => s.submit('hi'));

assert.equal(frames[0].events[0].key, 'draft');
assert.equal(composer.draft, 'hi');
assert.equal(journal.record().level, 'off');
assert.equal(vite().name, 'expressive-inspect');

console.log('inspect: install + act + bridge + vite ok');
`
};

/**
 * A dom app built the way a consumer builds one: type-checked against the
 * published declarations with `skipLibCheck` off, bundled and minified so
 * `sideEffects` tree-shaking applies, then driven under happy-dom.
 */
const CONSUMER = {
  'tsconfig.json': JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      strict: true,
      noEmit: true,
      skipLibCheck: false,
      jsx: 'react-jsx',
      jsxImportSource: '@expressive/dom'
    },
    include: ['app.tsx']
  }),
  'app.tsx': `
import { Component, has } from '@expressive/mvc';
import { Provider, render } from '@expressive/dom';
import { Link, Route, Router } from '@expressive/router';

class Item extends Component {
  name = '';

  render() {
    return <li>{this.name}</li>;
  }
}

class List extends Component {
  items = has(Item);
  draft = '';

  new() {
    this.items.add({ name: 'a' });
  }

  add() {
    this.items.add({ name: this.draft });
    this.draft = '';
  }

  render() {
    return (
      <section>
        <input id="draft" value={this.draft} onInput={(event) => (this.draft = event.currentTarget.value)} />
        <button id="add" onClick={this.add}>add</button>
        <ul id="items">{this.items}</ul>
      </section>
    );
  }
}

const Frame = (props: { children?: Component.Node }) => (
  <main>
    <Link to="/other">other</Link>
    <Provider fallback={<p>loading</p>}>{props.children}</Provider>
  </main>
);

const Other = () => <p id="other">other</p>;

export function mount(root: Element) {
  return render(
    <Router>
      <Route as={Frame}>
        <Route as={List} />
        <Route to="other" as={Other} />
      </Route>
    </Router>,
    root
  );
}
`,
  'consumer.mjs': `
import assert from 'node:assert/strict';
import { Window } from 'happy-dom';

const window = new Window({ url: 'http://localhost/' });

for (const key of ['window', 'document', 'navigator', 'location', 'history', 'Node', 'Element', 'HTMLElement', 'SVGElement', 'DocumentFragment', 'CSSStyleSheet', 'getComputedStyle'])
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key == 'window' ? window : window[key] });

const { mount } = await import('./bundle.js');
const root = document.body.appendChild(document.createElement('div'));
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

mount(root);
await tick();
assert.equal(root.querySelector('#items').textContent, 'a');

const draft = root.querySelector('#draft');
draft.value = 'b';
draft.dispatchEvent(new window.Event('input', { bubbles: true }));
root.querySelector('#add').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await tick();
assert.equal(root.querySelector('#items').textContent, 'ab');
assert.equal(draft.value, '');

root.querySelector('a').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
await tick(20);
assert.equal(root.querySelector('#other')?.textContent, 'other');

console.log('dom: consumer type-check, bundle and render ok');
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

const ROOT = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
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
        dependencies: {
          ...tarballs,
          react: '^19',
          'react-dom': '^19',
          'happy-dom': ROOT.devDependencies['happy-dom'],
          typescript: ROOT.devDependencies.typescript
        },
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

  for (const [file, source] of Object.entries(CONSUMER))
    writeFileSync(join(fixture, file), source);

  run(['node', 'node_modules/typescript/bin/tsc', '-p', '.'], fixture);
  run(['bun', 'build', 'app.tsx', '--outfile', 'bundle.js', '--format', 'esm', '--minify'], fixture);
  process.stdout.write(run(['node', 'consumer.mjs'], fixture));
} catch (error) {
  console.error(`Fixture kept for inspection: ${fixture}`);
  throw error;
}

rmSync(fixture, { recursive: true, force: true });

console.log('\nPublished dist imports and executes under Node ESM.');
