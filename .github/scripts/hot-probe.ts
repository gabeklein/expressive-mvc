import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createServer, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

import inspect from '../../packages/inspect/src/vite';
import domHot from '../../packages/dom/src/vite';
import reactHot from '../../packages/react/src/vite';

/**
 * Class and component HMR, end to end: a fixture app per host runs under a Vite
 * dev server with the host's hot plugin and inspect's relay, headless Chrome
 * loads it, and each scenario edits a module and asserts - through the relay
 * where state is the question - that the edit applied, state survived and the
 * app still works. Skips when Chrome is absent; set `CHROME` to a binary.
 */
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

if (!(await Bun.file(CHROME).exists())) {
  console.log(`No Chrome at ${CHROME} - set CHROME to run the hot probe.`);
  process.exit(0);
}

type Mode = 'react' | 'dom';

const ROOT = resolve('.hot-probe');
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
  'routed.tsx': `import { Route } from '@expressive/router';
import { Page } from './page';

export const Routed = () => <Route as={Page} />;
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
`
};

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
${badge ? "import { Wrapper } from './badge';\n" : ''}
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
    ${badge ? '<Wrapper />' : ''}
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
  const plugins: Plugin[] = mode == 'react' ? [react(), inspect(), reactHot()] : [inspect(), domHot()];
  const server = await createServer({
    configFile: false,
    root: dir,
    logLevel: 'silent',
    cacheDir: join(ROOT, `.vite-${mode}`),
    plugins,
    esbuild: mode == 'dom' ? { jsx: 'automatic', jsxImportSource: '@expressive/dom' } : undefined,
    resolve: {
      alias: {
        host: src(mode),
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

  async open(url: string, profile: string) {
    const port = 9300 + Math.floor(Math.random() * 500);

    this.proc = Bun.spawn([
      CHROME, '--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`, 'about:blank'
    ], { stdout: 'ignore', stderr: 'ignore' });

    const targets = await until(async () => {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      return list.find((target: any) => target.type == 'page');
    }, 10000);

    this.ws = new WebSocket(targets.webSocketDebuggerUrl);
    await new Promise((ready) => (this.ws.onopen = ready));
    this.ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) this.pending.get(message.id)?.(message);
      else if (message.method == 'Runtime.consoleAPICalled' && message.params.type == 'error')
        this.errors.push(message.params.args.map((arg: any) => arg.value ?? arg.description).join(' '));
      else if (message.method == 'Runtime.exceptionThrown')
        this.errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    };

    await this.send('Runtime.enable');
    await this.send('Page.navigate', { url });
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
  const files = { ...shared, 'app.tsx': app(mode), 'main.tsx': main[mode] };

  if (mode == 'react') delete files['badge.tsx'];

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

  const edit = async (file: string, from: string, to: string) => {
    const path = join(dir, file);
    const text = await Bun.file(path).text();
    if (!text.includes(from)) throw new Error(`"${from}" not in ${file}`);
    await Bun.write(path, text.replace(from, to));
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

    await scenario('field change reloads and says why', async () => {
      await edit('settings.ts', "unit = 's';", "unit = 's';\n  extra = 1;");
      await until(async () => !(await alive()) && (await browser.text('#clock')) == '[5s]', 10000);

      const reload = await until(async () => {
        const events = (await relay('journal.frames')).flatMap((frame: any) => frame.events);
        return events.find((e: any) => e.kind == 'hot' && e.key == 'reload');
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

let failed = 0;

try {
  for (const mode of ['react', 'dom'] as const) failed += await run(mode);
} finally {
  rmSync(ROOT, { recursive: true, force: true });
}

console.log(failed ? `\n${failed} hot reload scenario(s) failed.` : '\nHot reload verified in Chrome.');
process.exit(failed ? 1 : 0);
