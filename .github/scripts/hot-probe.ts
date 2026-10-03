import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import type { Plugin } from 'vite';

import inspect from '../../packages/inspect/src/vite';
import domHot from '../../packages/dom/src/vite';
import reactHot from '../../packages/react/src/vite';

/**
 * Class and component HMR, end to end: a fixture app per host, on the examples
 * app's toolchain, runs under a Vite dev server with the host's hot plugin and
 * inspect's relay; headless Chrome loads it, and each scenario edits a module
 * and asserts - through the relay where state is the question - that the edit
 * applied, state survived and the app still works. A server section drives
 * Vite's module runner the way a session host would. The browser modes skip
 * when Chrome is absent; set `CHROME` to a binary.
 */
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const chrome = await Bun.file(CHROME).exists();

type Mode = 'react' | 'strict' | 'dom';

const host = (mode: Mode) => (mode == 'dom' ? 'dom' : 'react');

const examples = createRequire(resolve('examples/package.json'));
const { createServer, createServerModuleRunner } = (await import(examples.resolve('vite'))) as typeof import('vite');
const { default: react } = (await import(examples.resolve('@vitejs/plugin-react'))) as typeof import('@vitejs/plugin-react');

const ROOT = resolve('examples/.hot-probe');
const src = (pkg: string) => resolve('packages', pkg, 'src');

const shared: Record<string, string> = {
  'timer.tsx': `import { Component } from '@expressive/mvc';

export class Timer extends Component {
  count = 0;

  new() {
    const id = setInterval(() => this.count++, 20);
    return () => clearInterval(id);
  }

  render() {
    return <p id="timer" style={{ color: 'rgb(255, 0, 0)' }}>tick {this.count}</p>;
  }
}
`,
  'settings.ts': `import { State } from '@expressive/mvc';

export class Settings extends State {
  unit = 's';

  format(n: number) {
    return n + this.unit;
  }
}
`,
  'clock.tsx': `import { Component, get } from '@expressive/mvc';
import { Settings } from './settings';

export class Clock extends Component {
  settings = get(Settings);
  seconds = 5;

  render() {
    const { settings, seconds } = this;
    const { unit } = settings;

    return <p id="clock" data-unit={unit}>{settings.format(seconds)}</p>;
  }
}
`,
  'child.ts': `import { State } from '@expressive/mvc';

export class Child extends State {
  value = 1;

  label() {
    return 'child ' + this.value;
  }
}
`,
  'parent.tsx': `import { Component } from '@expressive/mvc';
import { Child } from './child';

export class Parent extends Component {
  child = new Child();

  render() {
    const { child } = this;
    const { value } = child;

    return <p id="child" data-value={value}>{child.label()}</p>;
  }
}
`,
  'row.ts': `import { State } from '@expressive/mvc';

export class Row extends State {
  n = 0;

  text() {
    return 'row ' + this.n;
  }
}
`,
  'list.tsx': `import { Component, has } from '@expressive/mvc';
import { Row } from './row';

export class List extends Component {
  rows = has(Row);

  new() {
    for (const n of [1, 2, 3]) this.rows.add({ n });
  }

  render() {
    return <ul id="rows">{[...this.rows].map((row) => <li key={row.n}>{row.text()}</li>)}</ul>;
  }
}
`,
  'theme.ts': `import { State } from '@expressive/mvc';

export class Theme extends State {
  hue = 'red';

  get label() {
    return 'theme ' + this.hue;
  }
}
`,
  'themed.tsx': `import { Theme } from './theme';

export const Themed = () => <p id="themed">view {Theme.get().label}</p>;
`,
  'base.ts': `import { State } from '@expressive/mvc';

export class Base extends State {
  amount = 1;

  describe() {
    return 'base ' + this.amount;
  }
}
`,
  'derived.tsx': `import { Component } from '@expressive/mvc';
import { Base } from './base';

export class Derived extends Base {}

export class Shown extends Component {
  item = new Derived();

  render() {
    const { item } = this;
    const { amount } = item;

    return <p id="derived" data-amount={amount}>{item.describe()}</p>;
  }
}
`,
  'watcher.tsx': `import { Component } from '@expressive/mvc';

const log = ((window as any).__effect ||= { runs: 0, cleanups: 0 });

export class Watcher extends Component {
  value = 1;

  new() {
    return this.get((self) => {
      void self.value;
      log.runs++;
      return () => void log.cleanups++;
    });
  }

  render() {
    return <p id="watcher">watch {this.value}</p>;
  }
}
`,
  'models/counter.ts': `import { State } from '@expressive/mvc';

export class Counter extends State {
  total = 1;

  show() {
    return 'count ' + this.total;
  }
}
`,
  'models/index.ts': `export { Counter } from './counter';
`,
  'barrel.tsx': `import { Component } from '@expressive/mvc';
import { Counter } from './models';

export class Tally extends Component {
  counter = new Counter();

  render() {
    const { counter } = this;
    const { total } = counter;

    return <p id="barrel" data-total={total}>{counter.show()}</p>;
  }
}
`,
  'page.tsx': `import { Component } from '@expressive/mvc';

export class Page extends Component {
  visits = 2;

  render() {
    return <p id="page">page {this.visits}</p>;
  }
}
`,
  'away.tsx': `import { Component } from '@expressive/mvc';

(window as any).__away = ((window as any).__away || 0) + 1;

export class Away extends Component {
  render() {
    return <p id="away">away</p>;
  }
}
`,
  'routed.tsx': `import { Route } from '@expressive/router';
import { Page } from './page';
import { Away } from './away';

export const Routed = () => (
  <Route>
    <Route as={Page} />
    <Route to="away" as={Away} />
  </Route>
);
`,
  'badge.tsx': `import { Component } from '@expressive/mvc';
import { style } from '@expressive/dom';

export class Badge extends Component {
  clicks = 0;

  render() {
    return <b id="badge">badge {this.clicks}</b>;
  }
}

style(Badge, { color: 'rgb(255, 0, 0)' });

export const Wrapper = () => <div id="wrapper"><Badge /></div>;
`,
  'loader.tsx': `import { Component, set } from '@expressive/mvc';

export class Loader extends Component {
  data = set<string>();
  fallback = <p id="loader">loading</p>;

  render() {
    return <p id="loader">loaded {this.data}</p>;
  }
}
`,
  'late.tsx': `import { Component } from '@expressive/mvc';

export default class Late extends Component {
  seen = 1;

  render() {
    return <p id="late">late {this.seen}</p>;
  }
}
`,
  'kit.tsx': `import { Component, map, ref, set } from '@expressive/mvc';

export class Kit extends Component {
  node = ref<HTMLElement>();
  tags = map<string, number>();
  base = 2;
  doubled = set((self: Kit) => self.base * 2);

  new() {
    this.tags.set('a', 1);
  }

  format(doubled: number, size: number) {
    return 'kit ' + doubled + ' ' + size;
  }

  probe() {
    return this.node.current?.id + ':' + this.tags.get('a') + ':' + this.doubled;
  }

  render() {
    const { doubled, tags } = this;

    return <p id="kit" ref={this.node}>{this.format(doubled, tags.size)}</p>;
  }
}
`,
  'pill.tsx': `import { Component } from '@expressive/mvc';

export class Pill extends Component {
  tag = '';
  hits = 0;

  render() {
    const { tag, hits } = this;

    return <i id={'pill-' + tag} onClick={() => this.hits++}>pill {hits}</i>;
  }
}
`,
  'vault.tsx': `import { Component } from '@expressive/mvc';

export class Vault extends Component {
  #key = 'k';

  reveal() {
    return 'vault ' + this.#key;
  }

  render() {
    return <p id="vault">{this.reveal()}</p>;
  }
}
`,
  'deck.tsx': `import { Component } from '@expressive/mvc';

export class Deck extends Component {
  title = 'deck';

  Header() {
    const { title } = this;

    return <h2 id="deck">{title} head</h2>;
  }

  render() {
    return <this.Header />;
  }
}
`,
  'folio.tsx': `import { State } from '@expressive/mvc';

class Hits extends State {
  count = 0;
}

export class Folio extends State {
  title = 'folio';

  Header() {
    const { title } = this;
    const hits = Hits.use();

    return <h3 id="folio" onClick={() => hits.count++}>{title} head {hits.count}</h3>;
  }

  render() {
    return <this.Header />;
  }
}
`,
  'guard.tsx': `import { Component } from '@expressive/mvc';

function Fuse({ label }: { label: string }) {
  const { armed } = Guard.get();

  if (armed) throw new Error('boom');

  return <p id="guard">{label}</p>;
}

export class Guard extends Component {
  armed = false;

  async catch() {
    this.fallback = <p id="guard">caught</p>;
    await new Promise((resolve) => ((window as any).__recover = resolve));
  }

  render() {
    return <Fuse label="safe" />;
  }
}
`,
  'stage.tsx': `import { Component, pending, set } from '@expressive/mvc';

function Scene() {
  const stage = Stage.get();
  const { step } = stage;

  if (step == 2) return <p id="stage">{stage.label(step)} {stage.extra}</p>;

  return <p id="stage">{stage.label(step)}</p>;
}

export class Stage extends Component {
  step = 1;
  extra = set<string>();
  fallback = <p id="stage">wait</p>;

  go() {
    pending(() => {
      this.step = 2;
    });
  }

  label(step: number) {
    return 'scene ' + step;
  }

  render() {
    return <Scene />;
  }
}
`,
  'labels.ts': `import { State } from '@expressive/mvc';

export const PREFIX = 'note';

export class Note extends State {
  count = 1;
}
`,
  'noted.tsx': `import { Component } from '@expressive/mvc';
import { Note, PREFIX } from './labels';

export class Noted extends Component {
  note = new Note();

  render() {
    const { count } = this.note;

    return <p id="note">{PREFIX} {count}</p>;
  }
}
`
};

const shell = (from: string) => `import { Component } from '@expressive/mvc';
import { lazy } from '${from}';

const Late = lazy(() => import('./late'));

export class Shell extends Component {
  fallback = <p id="late">wait</p>;

  render() {
    return <Late />;
  }
}
`;

function app(mode: Mode) {
  const badge = mode == 'dom';

  return `import { Provider } from 'host';
import { Timer } from './timer';
import { Clock } from './clock';
import { Settings } from './settings';
import { Parent } from './parent';
import { List } from './list';
import { Theme } from './theme';
import { Themed } from './themed';
import { Shown } from './derived';
import { Watcher } from './watcher';
import { Tally } from './barrel';
import { Routed } from './routed';
import { Loader } from './loader';
import { Shell } from './shell';
import { Kit } from './kit';
import { Pill } from './pill';
import { Noted } from './noted';
import { Vault } from './vault';
import { Deck } from './deck';
import { Guard } from './guard';
import { Stage } from './stage';
${badge ? "import { Wrapper } from './badge';\nimport { Folio } from './folio';\n" : ''}
export const App = () => (
  <Provider for={{ Settings, Theme }}>
    <Timer />
    <Clock />
    <Parent />
    <List />
    <Themed />
    <Shown />
    <Watcher />
    <Tally />
    <Routed />
    <Loader />
    <Shell />
    <Kit />
    <Pill tag="a" />
    <Pill tag="b" />
    <Noted />
    <Vault />
    <Deck />
    <Guard />
    <Stage />
    ${badge ? '<Wrapper /><Folio />' : ''}
  </Provider>
);
`;
}

const main: Record<Mode, string> = {
  react: `import '@expressive/react';
import { createRoot } from 'react-dom/client';
import { App } from './app';

createRoot(document.getElementById('root')!).render(<App />);
`,
  strict: `import '@expressive/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
`,
  dom: `import { render } from '@expressive/dom';
import { App } from './app';

render(<App />, document.getElementById('root')!);
`
};

function write(dir: string, files: Record<string, string>) {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
}

async function serve(mode: Mode, dir: string) {
  const plugins: Plugin[] = host(mode) == 'react' ? [react(), inspect(), reactHot()] : [inspect(), domHot()];
  const server = await createServer({
    configFile: false,
    root: dir,
    logLevel: 'silent',
    cacheDir: join(ROOT, `.vite-${mode}`),
    plugins,
    esbuild: host(mode) == 'dom' ? { jsx: 'automatic', jsxImportSource: '@expressive/dom' } : undefined,
    resolve: {
      alias: {
        host: src(host(mode)),
        '@expressive/inspect': src('inspect'),
        '@expressive/router': src('router'),
        '@expressive/react': src('react'),
        '@expressive/dom': src('dom'),
        '@expressive/mvc': src('mvc')
      }
    },
    server: { port: 0, strictPort: false }
  });

  await server.listen();

  const address = server.httpServer!.address() as { port: number };
  return { server, base: `http://localhost:${address.port}` };
}

class Browser {
  private ws!: WebSocket;
  private id = 0;
  private pending = new Map<number, (value: any) => void>();
  private proc!: ReturnType<typeof Bun.spawn>;
  errors: string[] = [];
  warnings: string[] = [];

  async open(url: string, profile: string) {
    const targets = await this.launch(profile).catch(() => this.launch(profile));

    this.ws = new WebSocket(targets.webSocketDebuggerUrl);
    await new Promise((ready) => (this.ws.onopen = ready));
    this.ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) this.pending.get(message.id)?.(message);
      else if (message.method == 'Runtime.consoleAPICalled' && message.params.type == 'warning')
        this.warnings.push(message.params.args.map((arg: any) => arg.value ?? arg.description).join(' '));
      else if (message.method == 'Runtime.consoleAPICalled' && message.params.type == 'error')
        this.errors.push(message.params.args.map((arg: any) => arg.value ?? arg.description).join(' '));
      else if (message.method == 'Runtime.exceptionThrown')
        this.errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    };

    await this.send('Runtime.enable');
    await this.send('Page.navigate', { url });
  }

  private async launch(profile: string) {
    const port = 9300 + Math.floor(Math.random() * 500);

    this.proc = Bun.spawn([
      CHROME, '--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`, 'about:blank'
    ], { stdout: 'ignore', stderr: 'ignore' });

    try {
      return await until(async () => {
        const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
        return list.find((target: any) => target.type == 'page');
      }, 15000);
    } catch (error) {
      this.proc.kill();
      await this.proc.exited;
      throw error;
    }
  }

  send(method: string, params = {}) {
    return new Promise<any>((done) => {
      const id = ++this.id;
      this.pending.set(id, done);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression: string) {
    const reply = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return reply.result?.result?.value;
  }

  text(selector: string) {
    return this.eval(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`);
  }

  color(selector: string) {
    return this.eval(`(() => { const node = document.querySelector(${JSON.stringify(selector)}); return node && getComputedStyle(node).color; })()`);
  }

  async close() {
    this.ws?.close();
    this.proc?.kill();
    await this.proc?.exited;
  }
}

async function until<T>(check: () => Promise<T | undefined | false | null>, timeout = 6000): Promise<T> {
  const end = Date.now() + timeout;
  let last: unknown;

  while (Date.now() < end) {
    try {
      const value = await check();
      if (value) return value as T;
    } catch (error) {
      last = error;
    }
    await Bun.sleep(100);
  }

  throw new Error(`timed out${last ? `: ${last}` : ''}`);
}

const sleep = (ms: number) => Bun.sleep(ms);

async function run(mode: Mode) {
  const dir = join(ROOT, mode);
  const files = {
    ...shared,
    'shell.tsx': shell(host(mode) == 'dom' ? '@expressive/dom' : 'react'),
    'app.tsx': app(mode),
    'main.tsx': main[mode]
  };

  if (mode != 'dom') {
    delete files['badge.tsx'];
    delete files['folio.tsx'];
  }

  write(dir, {
    ...files,
    'index.html': '<!doctype html><html><body><div id="root"></div><script type="module" src="/main.tsx"></script></body></html>'
  });

  const { server, base } = await serve(mode, dir);
  const browser = new Browser();
  const results: [string, boolean, string?][] = [];

  const relay = async (...call: unknown[]) => {
    const response = await fetch(`${base}/__inspect`, { method: 'POST', body: JSON.stringify(call) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    return body;
  };

  const edit = async (file: string, ...pairs: string[]) => {
    const path = join(dir, file);
    let text = await Bun.file(path).text();

    for (let i = 0; i < pairs.length; i += 2) {
      if (!text.includes(pairs[i])) throw new Error(`"${pairs[i]}" not in ${file}`);
      text = text.replace(pairs[i], pairs[i + 1]);
    }

    await Bun.write(path, text);
  };

  const hot = async (since: number) => {
    const events = (await relay('journal.frames', { since })).flatMap((frame: any) => frame.events);
    return {
      patched: (type: string) => events.some((e: any) => e.kind == 'hot' && e.key == 'patch' && e.type == type),
      destroyed: (type: string) => events.some((e: any) => e.kind == 'destroy' && e.type == type)
    };
  };

  const scenario = async (name: string, body: () => Promise<void>) => {
    try {
      await body();
      results.push([name, true]);
      console.log(`PASS [${mode}] ${name}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      results.push([name, false, reason]);
      console.log(`FAIL [${mode}] ${name} - ${reason}`);
    }
  };

  const see = (selector: string, expected: string, timeout?: number) =>
    until(async () => (await browser.text(selector)) == expected, timeout).catch(async () => {
      throw new Error(`${selector} shows ${JSON.stringify(await browser.text(selector))}, expected ${JSON.stringify(expected)}`);
    });

  const check = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
  };

  try {
    await browser.open(base + '/', join(ROOT, `.chrome-${mode}`));
    await until(async () => (await (await fetch(`${base}/__inspect`)).json()).length > 0, 15000);
    await until(() => browser.text('#timer'));
    await browser.eval(`window.__probe = 'alive'`);

    const orphans = async () => (await relay('health')).orphans as number;
    const { baseline } = await until(async () => {
      const count = await orphans();
      await sleep(300);
      return (await orphans()) == count && { baseline: count };
    });
    const alive = async () => (await browser.eval('window.__probe')) === 'alive';

    await scenario('timer keeps its count and rate through a render edit', async () => {
      const a = await relay('get', 'Timer.count');
      await sleep(400);
      const b = await relay('get', 'Timer.count');

      await edit('timer.tsx', "'rgb(255, 0, 0)'", "'rgb(0, 0, 255)'");
      await until(async () => (await browser.color('#timer')) == 'rgb(0, 0, 255)');

      const c = await relay('get', 'Timer.count');
      await sleep(400);
      const d = await relay('get', 'Timer.count');

      check(c >= b, `count reset: ${b} before, ${c} after`);
      check(d - c > (b - a) * 0.4, `stopped ticking: ${b - a} then ${d - c} per 400ms`);
      check(d - c < (b - a) * 1.7, `interval doubled: ${b - a} then ${d - c} per 400ms`);
      check(await alive(), 'page reloaded');
    });

    await scenario('class reached through get() takes a method edit, both keep state', async () => {
      await relay('set', 'Clock.seconds', 7);
      await relay('set', 'Settings.unit', 'm');
      await see('#clock', '7m');

      const since = await relay('journal.seq');
      await edit('settings.ts', 'return n + this.unit;', "return '[' + n + this.unit + ']';");
      await see('#clock', '[7m]');

      const journal = await hot(since);
      check(journal.patched('Settings'), 'no patch recorded for Settings');
      check(!journal.destroyed('Settings') && !journal.destroyed('Clock'), 'an instance was destroyed');
      check(await alive(), 'page reloaded');
    });

    await scenario('owned child is patched in place', async () => {
      await relay('set', 'Child.value', 3);
      await see('#child', 'child 3');
      await edit('child.ts', "return 'child ' + this.value;", "return 'kid ' + this.value;");
      await see('#child', 'kid 3');
      check(await alive(), 'page reloaded');
    });

    await scenario('collection rows keep their members through a row edit', async () => {
      await see('#rows', 'row 1row 2row 3');

      const since = await relay('journal.seq');
      await edit('row.ts', "return 'row ' + this.n;", "return 'item ' + this.n;");
      await see('#rows', 'item 1item 2item 3');
      check(!(await hot(since)).destroyed('Row'), 'a row was destroyed');
      check(await alive(), 'page reloaded');
    });

    await scenario('provided class takes a getter edit, consumer stays connected', async () => {
      await relay('set', 'Theme.hue', 'blue');
      await see('#themed', 'view theme blue');
      await edit('theme.ts', "return 'theme ' + this.hue;", "return 'palette ' + this.hue;");
      await see('#themed', 'view palette blue');

      await relay('set', 'Theme.hue', 'green');
      await see('#themed', 'view palette green');
      check(await alive(), 'page reloaded');
    });

    await scenario('function component edit keeps the state it reads', async () => {
      await edit('themed.tsx', 'view {Theme', 'seen {Theme');
      await see('#themed', 'seen palette green');
      check(await alive(), 'page reloaded');
    });

    await scenario('subclass in another module follows a base class edit', async () => {
      await relay('set', 'Derived.amount', 4);
      await see('#derived', 'base 4');
      await edit('base.ts', "return 'base ' + this.amount;", "return 'core ' + this.amount;");
      await see('#derived', 'core 4');
      check(await alive(), 'page reloaded');
    });

    await scenario('effect re-runs once per patch, its cleanup with it', async () => {
      const before = await browser.eval('({ ...window.__effect })');

      check(before.runs == before.cleanups + 1, `effect leaked before editing: ${JSON.stringify(before)}`);
      await edit('watcher.tsx', "watch {this.value}", "seen {this.value}");
      await see('#watcher', 'seen 1');
      await sleep(300);

      const after = await browser.eval('({ ...window.__effect })');

      check(after.runs == after.cleanups + 1, `effect leaked: ${JSON.stringify(after)}`);
      check(after.runs - before.runs <= 1, `effect ran ${after.runs - before.runs} times for one edit`);

      await relay('set', 'Watcher.value', 2);
      await see('#watcher', 'seen 2');
      check(await alive(), 'page reloaded');
    });

    await scenario('class re-exported through a barrel is patched', async () => {
      await relay('set', 'Counter.total', 9);
      await see('#barrel', 'count 9');
      await edit('models/counter.ts', "return 'count ' + this.total;", "return 'total ' + this.total;");
      await see('#barrel', 'total 9');
      check(await alive(), 'page reloaded');
    });

    await scenario('routed page takes a render edit, route and page state kept', async () => {
      await relay('set', 'Page.visits', 5);
      await see('#page', 'page 5');
      await edit('page.tsx', 'page {this.visits}', 'viewed {this.visits}');
      await see('#page', 'viewed 5');
      check(await alive(), 'page reloaded');
    });

    if (mode == 'dom')
      await scenario('style map edit applies without a reset (dom)', async () => {
        await relay('set', 'Badge.clicks', 5);
        await see('#badge', 'badge 5');
        await edit('badge.tsx', "style(Badge, { color: 'rgb(255, 0, 0)' });", "style(Badge, { color: 'rgb(0, 128, 0)' });");
        await until(async () => (await browser.color('#badge')) == 'rgb(0, 128, 0)');
        check((await browser.text('#badge')) == 'badge 5', 'clicks reset');
        check(await alive(), 'page reloaded');
      });

    await scenario('interaction still works after every edit', async () => {
      await relay('set', 'Clock.seconds', 11);
      await see('#clock', '[11m]');
      await relay('set', 'Child.value', 8);
      await see('#child', 'kid 8');
    });

    const overlay = () => browser.eval(`!!document.querySelector('vite-error-overlay')`);

    await scenario('a syntax error, then its fix, patches from the last good version', async () => {
      const since = await relay('journal.seq');
      await edit('theme.ts', "return 'palette ' + this.hue;", "return 'palette ' + ;");
      await until(overlay);
      await edit('theme.ts', "return 'palette ' + ;", "return 'hue ' + this.hue;");
      await see('#themed', 'seen hue green');
      check(!(await overlay()), 'error overlay still up');
      check(!(await hot(since)).destroyed('Theme'), 'Theme was destroyed');
      check(await alive(), 'page reloaded');
    });

    await scenario('rapid saves settle on the last one', async () => {
      await relay('set', 'Page.visits', 6);
      await see('#page', 'viewed 6');

      for (const [from, to] of [['viewed {', 'one {'], ['one {', 'two {'], ['two {', 'three {']]) {
        await edit('page.tsx', from, to);
        // chokidar drops a change to the same file within 50ms of the last, with no trailing event
        await sleep(100);
      }

      await see('#page', 'three 6');
      await sleep(500);
      check((await browser.text('#page')) == 'three 6', `settled on ${await browser.text('#page')}`);
      check(await alive(), 'page reloaded');
    });

    await scenario('model and view saved together both apply', async () => {
      await edit('child.ts', "return 'kid ' + this.value;", "return 'tot ' + this.value;");
      await edit('parent.tsx', '{child.label()}</p>', '{child.label()}!</p>');
      await see('#child', 'tot 8!');
      check(await alive(), 'page reloaded');
    });

    await scenario('adding a class to a module leaves the rest patching', async () => {
      const since = await relay('journal.seq');
      await edit(
        'child.ts',
        'export class Child', 'export class Spare extends State {\n  on = true;\n}\n\nexport class Child',
        "return 'tot ' + this.value;", "return 'add ' + this.value;"
      );
      await see('#child', 'add 8!');
      check((await hot(since)).patched('Child'), 'no patch recorded for Child');
      check(await alive(), 'page reloaded');
    });

    await scenario('removing a class re-runs importers without a reload', async () => {
      const since = await relay('journal.seq');
      await edit(
        'child.ts',
        'export class Spare extends State {\n  on = true;\n}\n\n', '',
        "return 'add ' + this.value;", "return 'less ' + this.value;"
      );
      await see('#child', 'less 8!');
      check(!(await hot(since)).destroyed('Child'), 'Child was destroyed');
      await relay('set', 'Child.value', 9);
      await see('#child', 'less 9!');
      check(await alive(), 'page reloaded');
    });

    await scenario('a plain export change re-runs importers, their classes patched', async () => {
      await relay('set', 'Note.count', 3);
      await see('#note', 'note 3');
      await edit('labels.ts', "PREFIX = 'note'", "PREFIX = 'memo'");
      await see('#note', 'memo 3');
      await relay('set', 'Note.count', 4);
      await see('#note', 'memo 4');
      check(await alive(), 'page reloaded');
    });

    await scenario('editing a suspended component applies once it resolves', async () => {
      await see('#loader', 'loading');

      const since = await relay('journal.seq');
      await edit('loader.tsx', 'loaded {', 'ready {');
      await until(async () => (await hot(since)).patched('Loader'));
      check((await browser.text('#loader')) == 'loading', 'fallback dropped before resolving');

      await relay('set', 'Loader.data', 'yes');
      await see('#loader', 'ready yes');
      check(await alive(), 'page reloaded');
    });

    await scenario('lazily loaded component takes a render edit', async () => {
      await see('#late', 'late 1');
      await relay('set', 'Late.seen', 4);
      await see('#late', 'late 4');
      await edit('late.tsx', 'late {', 'later {');
      await see('#late', 'later 4');
      check(await alive(), 'page reloaded');
    });

    await scenario('ref, map and computed keep their values through a method edit', async () => {
      await relay('set', 'Kit.base', 3);
      await relay('set', 'Kit.tags.b', 5);
      await see('#kit', 'kit 6 2');
      await edit('kit.tsx', "return 'kit ' +", "return 'box ' +");
      await see('#kit', 'box 6 2');

      const probe = await relay('call', 'Kit.probe');
      check(probe == 'kit:1:6', `ref, map or computed lost: ${probe}`);

      await relay('set', 'Kit.base', 4);
      await see('#kit', 'box 8 2');
      check(await alive(), 'page reloaded');
    });

    await scenario('two instances of one class both take an edit, each keeps its state', async () => {
      const click = (id: string) => browser.eval(`document.getElementById('${id}').click()`);

      await click('pill-a');
      await click('pill-a');
      await see('#pill-a', 'pill 2');
      await see('#pill-b', 'pill 0');
      await edit('pill.tsx', 'pill {hits}', 'chip {hits}');
      await see('#pill-a', 'chip 2');
      await see('#pill-b', 'chip 0');
      await click('pill-b');
      await see('#pill-b', 'chip 1');
      check(await alive(), 'page reloaded');
    });

    await scenario('subcomponent takes an edit, its state kept', async () => {
      await relay('set', 'Deck.title', 'd2');
      await see('#deck', 'd2 head');
      await edit('deck.tsx', 'head</h2>', 'top</h2>');
      await see('#deck', 'd2 top');
      await relay('set', 'Deck.title', 'd3');
      await see('#deck', 'd3 top');
      check(await alive(), 'page reloaded');
    });

    if (mode == 'dom')
      await scenario('plain State subcomponent takes an edit, its owner and slots kept (dom)', async () => {
        await browser.eval(`document.getElementById('folio').click()`);
        await see('#folio', 'folio head 1');
        await edit('folio.tsx', 'head {hits.count}', 'top {hits.count}');
        await see('#folio', 'folio top 1');
        await relay('set', 'Folio.title', 'f2');
        await see('#folio', 'f2 top 1');
        check(await alive(), 'page reloaded');
      });

    await scenario('component edited while showing its error recovers into the edit', async () => {
      await see('#guard', 'safe');
      await relay('set', 'Guard.armed', true);
      await see('#guard', 'caught');
      await edit('guard.tsx', '<Fuse label="safe" />', '<Fuse label="sound" />');

      const since = await relay('journal.seq');
      await until(async () => (await hot(since)).patched('Guard') || (await browser.text('#guard')) == 'sound').catch(() => {});
      await relay('set', 'Guard.armed', false);
      await browser.eval('window.__recover?.()');
      await see('#guard', 'sound');
      check(await alive(), 'page reloaded');
    });

    await scenario('edit during a pending transition applies once it resolves', async () => {
      await see('#stage', 'scene 1');
      await relay('call', 'Stage.go');
      await edit('stage.tsx', "return 'scene ' + step;", "return 'stage ' + step;");
      await sleep(300);
      await relay('set', 'Stage.extra', 'x');
      await see('#stage', 'stage 2 x');
      check(await alive(), 'page reloaded');
    });

    await scenario('page patched while unmounted shows the edit when navigated to', async () => {
      const runs = await browser.eval('window.__away');
      await edit('away.tsx', 'away</p>', 'gone</p>');
      await until(async () => (await browser.eval('window.__away')) > runs);
      await relay('call', 'Router.goto', '/away');
      await see('#away', 'gone');
      await relay('call', 'Router.goto', '/');
      await until(() => browser.text('#page'));
      check(await alive(), 'page reloaded');
    });

    await scenario('edits leave no more orphaned instances than a fresh page', async () => {
      await until(async () => (await orphans()) <= baseline).catch(async () => {
        throw new Error(`${await orphans()} orphans, ${baseline} on a fresh page`);
      });
    });

    const rearm = async () => {
      await until(async () => (await (await fetch(`${base}/__inspect`)).json()).length > 0);
      await browser.eval(`window.__probe = 'alive'`);
    };

    await scenario('class with private members reloads on edit and says why', async () => {
      await see('#vault', 'vault k');
      await edit('vault.tsx', "return 'vault ' +", "return 'safe ' +");
      await until(async () => !(await alive()) && (await browser.text('#vault')) == 'safe k', 10000);

      const reload = await until(async () => {
        const events = (await relay('journal.frames')).flatMap((frame: any) => frame.events);
        return events.find((e: any) => e.kind == 'hot' && e.key == 'reload' && e.value?.class == 'Vault');
      });

      check(reload.value.reason == 'private members', `reload reason: ${JSON.stringify(reload.value)}`);

      const warned = () => browser.warnings.filter((text) => text.startsWith('[expressive] Vault')).length;
      await until(async () => warned() == 1).catch(() => {
        throw new Error(`${warned()} private-member warnings after the reload`);
      });

      await rearm();
      await edit('vault.tsx', "return 'safe ' +", "return 'vault ' +");
      await until(async () => !(await alive()) && (await browser.text('#vault')) == 'vault k', 10000);
      await rearm();
      check(warned() == 1, `warned ${warned()} times`);
    });

    await scenario('renaming a class across modules reloads into a working app', async () => {
      await edit('row.ts', 'class Row', 'class Line');
      await edit('list.tsx', "import { Row } from './row';", "import { Line } from './row';", 'has(Row)', 'has(Line)');
      await until(async () => !(await alive()) && (await browser.text('#rows')) == 'item 1item 2item 3', 10000);
      await until(async () => (await (await fetch(`${base}/__inspect`)).json()).length > 0);
      await relay('set', 'Clock.seconds', 12);
      await see('#clock', '[12s]');
      check(!(await overlay()), 'error overlay up');
      await rearm();
    });

    await scenario('field change reloads and says why', async () => {
      await edit('settings.ts', "unit = 's';", "unit = 's';\n  extra = 1;");
      await until(async () => !(await alive()) && (await browser.text('#clock')) == '[5s]', 10000);

      const reload = await until(async () => {
        const events = (await relay('journal.frames')).flatMap((frame: any) => frame.events);
        return events.find((e: any) => e.kind == 'hot' && e.key == 'reload' && e.value?.class == 'Settings');
      });

      check(reload.value?.class == 'Settings', `reload reason: ${JSON.stringify(reload.value)}`);
    });
  } finally {
    await browser.close();
    server.httpServer?.closeAllConnections?.();
    await Promise.race([server.close(), sleep(5000)]);
  }

  for (const error of browser.errors) console.log(`  [${mode}] page error: ${error.split('\n')[0]}`);

  return results.filter(([, ok]) => !ok).length;
}

async function server() {
  const dir = join(ROOT, 'server');
  const results: boolean[] = [];

  write(dir, {
    'base.ts': `import { State } from '@expressive/mvc';

export class Base extends State {
  a = 1;

  hello() {
    return 'old';
  }
}
`,
    'session.ts': `import { Base } from './base';

export class Session extends Base {
  greet() {
    return 'hi ' + this.hello();
  }
}
`
  });

  const vite = await createServer({
    configFile: false,
    root: dir,
    logLevel: 'silent',
    cacheDir: join(ROOT, '.vite-server'),
    plugins: [reactHot()],
    resolve: { alias: { '@expressive/mvc': src('mvc') } },
    server: { middlewareMode: true }
  });

  const runner = createServerModuleRunner(vite.environments.ssr, { hmr: { logger: false } });
  const hot = await runner.import('@expressive/mvc/hot');
  const sessions = new Map<string, any>();
  const replaced: string[] = [];

  hot.replaced(({ name, prev }: { name: string; prev: Function }) => {
    replaced.push(name);
    for (const [key, session] of sessions)
      if (session instanceof prev) {
        session.set(null);
        sessions.delete(key);
      }
  });

  const session = async (key: string) => {
    if (!sessions.has(key)) sessions.set(key, (await runner.import('/session.ts')).Session.new());
    return sessions.get(key);
  };

  const edit = async (file: string, from: string, to: string) => {
    const path = join(dir, file);
    await Bun.write(path, (await Bun.file(path).text()).replace(from, to));
  };

  const scenario = async (name: string, body: () => Promise<void>) => {
    try {
      await body();
      results.push(true);
      console.log(`PASS [server] ${name}`);
    } catch (error) {
      results.push(false);
      console.log(`FAIL [server] ${name} - ${error instanceof Error ? error.message : error}`);
    }
  };

  const check = (condition: unknown, message: string) => {
    if (!condition) throw new Error(message);
  };

  try {
    const first = await session('u1');
    first.a = 5;

    await scenario('method edit patches a long-lived session in place', async () => {
      await edit('base.ts', "return 'old';", "return 'new';");
      await until(async () => (await session('u1')).greet() == 'hi new');
      check((await session('u1')) === first, 'session was rebuilt');
      check(first.a == 5, `state lost: a = ${first.a}`);
      check(!replaced.length, `reported replaced: ${replaced}`);
    });

    await scenario('field edit on a base retires sessions through hot.replaced', async () => {
      await edit('base.ts', 'a = 1;', 'a = 1;\n  b = 2;');
      await until(async () => replaced.includes('Base'));
      check(!sessions.has('u1'), 'session not retired');
    });

    await scenario('rematerialized session extends the new base', async () => {
      const next = await session('u1');
      check(next !== first, 'same instance');
      check(next.b == 2, `new field missing: b = ${next.b}`);
      check(next.greet() == 'hi new', `stale base method: ${next.greet()}`);
      check(replaced.includes('Session'), `subclass not reported: ${replaced}`);
    });

    await scenario('server transform carries no browser-only code', async () => {
      const result = await vite.environments.ssr.transformRequest('/base.ts');
      const code = result?.code ?? '';
      check(/\.accept\)\("\/base\.ts"/.test(code), 'no hot binding injected');
      check(!/sessionStorage|location\.reload|dispatchEvent/.test(code), 'browser-only code in the ssr transform');
    });
  } finally {
    await runner.close();
    await vite.close();
  }

  return results.filter((ok) => !ok).length;
}

let failed = 0;

try {
  failed += await server();

  if (chrome) for (const mode of ['react', 'strict', 'dom'] as const) failed += await run(mode);
  else console.log(`No Chrome at ${CHROME} - set CHROME to run the browser modes.`);
} finally {
  rmSync(ROOT, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} hot reload scenario(s) failed.` : '\nHot reload verified.');
process.exit(failed ? 1 : 0);
