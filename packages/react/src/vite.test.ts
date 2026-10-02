import { parseAst } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { State } from '@expressive/mvc';

import expressive from './vite';

type Result = Promise<{ code: string; map: null } | undefined>;

function transform(code: string, id = '/src/app.js', runtime: string | null = '/mvc/src/hot.js', ssr?: boolean): Result {
  const hook = expressive().transform as Function;
  const resolve = async () => runtime && { id: runtime };

  return hook.call({ parse: parseAst, resolve }, code, id, ssr === undefined ? undefined : { ssr });
}

async function inject(code: string, ssr?: boolean) {
  return (await transform(code, undefined, undefined, ssr))!.code.slice(code.length);
}

interface Run {
  locals: Record<string, unknown>;
  replace?: Record<string, unknown>;
  before?: Record<string, unknown>;
  next?: Record<string, unknown>;
  ssr?: boolean;
  data?: Record<string, unknown>;
}

async function run(code: string, { locals, replace = {}, before, next, ssr = false, data = {} }: Run) {
  const output = await inject(code, ssr);
  const body = output.replace(/^import .*$/gm, '').replaceAll('import.meta.hot', 'hot');
  const hot = { data: Object.assign(data, before && { expressive: before }), accept: vi.fn(), invalidate: vi.fn() };
  const location = ssr ? undefined : { reload: vi.fn() };
  const accept = (_id: string, classes: Record<string, unknown>) => ({ ...classes, ...replace });

  new Function('hot', 'location', '__accept', '__State', ...Object.keys(locals), body)(
    hot, location, accept, State, ...Object.values(locals)
  );

  if (next) hot.accept.mock.calls[0][0](next);

  return { hot, location: location! };
}

it('will apply during serve only, after other transforms', () => {
  expect(expressive()).toMatchObject({ apply: 'serve', enforce: 'post' });
});

describe('skip', () => {
  it('will skip a non-script module', async () => {
    expect(await transform('class A {}', '/src/app.css')).toBeUndefined();
  });

  it('will skip the mvc runtime itself', async () => {
    expect(await transform('class A {}', '/mvc/src/state.js')).toBeUndefined();
  });

  it('will transform without a resolved runtime', async () => {
    expect(await transform('class A {}', '/src/app.js', null)).toBeDefined();
  });

  it('will skip a dependency', async () => {
    expect(await transform('class A {}', '/node_modules/lib/index.js')).toBeUndefined();
  });

  it('will skip a module without classes', async () => {
    expect(await transform('export const title = "no class";')).toBeUndefined();
  });

  it('will skip a module mentioning class without declaring one', async () => {
    expect(await transform('export const className = "a";')).toBeUndefined();
  });
});

it('will resolve the runtime once', async () => {
  const resolve = vi.fn(async () => ({ id: '/mvc/src/hot.js' }));
  const hook = expressive().transform as Function;
  const context = { parse: parseAst, resolve };

  await hook.call(context, 'class A {}', '/src/a.js');
  await hook.call(context, 'class B {}', '/src/b.js');

  expect(resolve).toHaveBeenCalledTimes(1);
});

it('will name a module by its path from the project root', async () => {
  const plugin = expressive();
  const context = { parse: parseAst, resolve: async () => null };

  (plugin.configResolved as Function)({ root: '/project' });

  const { code } = await (plugin.transform as Function).call(context, 'class A {}', '/project/src/app.js');
  const outside = await (plugin.transform as Function).call(context, 'class A {}', '/elsewhere/app.js');

  expect(code).toContain('accept("/src/app.js",');
  expect(outside.code).toContain('accept("/elsewhere/app.js",');
});

it('will append the binding and keep source maps', async () => {
  const { code, map } = (await transform('class A {}', '/src/app.js?t=123'))!;

  expect(code).toContain(`import { accept as __accept } from '@expressive/mvc/hot';`);
  expect(code).toContain('__accept("/src/app.js", { A })');
  expect(code).toContain('import.meta.hot.accept(');
  expect(map).toBeNull();
});

describe('classes', () => {
  it('will bind top-level classes', async () => {
    const code = await inject('class A {}\nlet B = class {};\nvar C = class {};');

    expect(code).toContain('{ A, B, C }');
    expect(code).toContain('A = __hot.A;');
    expect(code).toContain('B = __hot.B;');
  });

  it('will not bind a class it cannot reassign', async () => {
    expect(await inject('class A {}\nconst B = class {};\nlet c = 1, [d] = [2];')).toContain('{ A }');
  });

  it('will bind exported classes', async () => {
    const code = await inject('export class A {}\nexport default class B {}');

    expect(code).toContain('{ A, B }');
    expect(code).toContain('const __exports = { "A": A, "default": B };');
  });
});

describe('exports', () => {
  const exports = async (code: string) =>
    (await inject(`class Store {}\n${code}`)).match(/const __exports = \{ (.*) \};/)![1];

  it('will record declarations', async () => {
    expect(await exports('export function helper() {}\nexport let a = 1, [b] = [2];'))
      .toBe('"helper": helper, "a": a');
  });

  it('will record specifiers by local name', async () => {
    expect(await exports('export { Store as Model, Store as "with-dash" };'))
      .toBe('"Model": Store, "with-dash": Store');
  });

  it('will ignore re-exports', async () => {
    expect(await exports("export { other } from './other';\nexport { Store };")).toBe('"Store": Store');
  });

  it('will record a default binding', async () => {
    expect(await exports('export default function App() {}')).toBe('"default": App');
    expect(await exports('export { Store as default };')).toBe('"default": Store');
  });

  it('will not record a default snapshot', async () => {
    expect(await exports('export default Store;')).toBe('');
  });

  it('will not record an anonymous default', async () => {
    expect(await exports('export default function () {}')).toBe('');
  });
});

describe('update', () => {
  class Store extends State {}
  class Plain {}
  const App = () => null;
  const source = 'export class Store {}\nclass Local {}\nclass Plain {}\nexport const App = () => null;\nexport let value = 1;';

  it('will remember classes on first run', async () => {
    const { hot, location } = await run(source, { locals: { Store, Local: Store, Plain, App, value: 1 } });

    expect(hot.data.expressive).toEqual({ Store, Local: Store, Plain });
    expect(location.reload).not.toHaveBeenCalled();
  });

  it('will keep patched classes', async () => {
    const { hot, location } = await run(source, {
      locals: { Store: class Store extends State {}, Local: Store, Plain, App, value: 1 },
      replace: { Store },
      before: { Store, Local: Store, Plain: class Plain {} }
    });

    expect(location.reload).not.toHaveBeenCalled();
    expect(hot.invalidate).not.toHaveBeenCalled();
  });

  it('will announce and reload for a class it could not patch', async () => {
    const announce = vi.fn();
    class Local extends State {}

    addEventListener('expressive:reload', announce);

    const { location } = await run(source, {
      locals: { Store, Local, Plain, App, value: 1 },
      before: { Store, Local: class Local extends State {}, Plain }
    });

    removeEventListener('expressive:reload', announce);

    expect(location.reload).toHaveBeenCalledTimes(1);
    expect(announce.mock.calls[0][0].detail).toEqual({ module: '/src/app.js', class: 'Local', reason: 'class changed shape' });
  });

  it('will leave a class it could not patch to the host on the server', async () => {
    const announce = vi.fn();

    addEventListener('expressive:reload', announce);

    const { hot } = await run(source, {
      locals: { Store, Local: class Local extends State {}, Plain, App, value: 1 },
      before: { Store, Local: Store, Plain },
      ssr: true
    });

    removeEventListener('expressive:reload', announce);

    expect(hot.invalidate).not.toHaveBeenCalled();
    expect(announce).not.toHaveBeenCalled();
  });

  it('will invalidate importers of a changed plain export on the server', async () => {
    const { hot } = await run(source, {
      locals: { Store, Local: Store, Plain, App, value: 1 },
      next: { Store, App, value: 2 },
      ssr: true
    });

    expect(hot.invalidate).toHaveBeenCalledWith('"value" export cannot be hot-patched.');
  });

  it('will keep browser-only code out of the server', async () => {
    const code = await inject('export class Vault { #key = 1; }', true);

    expect(code).not.toMatch(/sessionStorage|location|dispatchEvent|invalidate\(\)/);
  });

  it('will ignore a class no longer declared', async () => {
    const { location } = await run('class Store {}', { locals: { Store }, before: { Store, Gone: Store } });

    expect(location.reload).not.toHaveBeenCalled();
  });

  it('will pass without next exports', async () => {
    const { hot } = await run(source, { locals: { Store, Local: Store, Plain, App, value: 1 }, next: undefined });

    expect(hot.invalidate).not.toHaveBeenCalled();
  });

  it('will leave a changed State class to the reload', async () => {
    const { hot } = await run(source, {
      locals: { Store, Local: Store, Plain, App, value: 1 },
      next: { Store: class Store extends State {}, App, value: 1 }
    });

    expect(hot.invalidate).not.toHaveBeenCalled();
  });

  it('will pass a changed component', async () => {
    const { hot } = await run(source, {
      locals: { Store, Local: Store, Plain, App, value: 1 },
      next: { Store, App: () => null, value: 1 }
    });

    expect(hot.invalidate).not.toHaveBeenCalled();
  });

  it('will invalidate another changed export', async () => {
    const { hot } = await run(source, {
      locals: { Store, Local: Store, Plain, App, value: 1 },
      next: { Store, App, value: 2 }
    });

    expect(hot.invalidate).toHaveBeenCalledWith('"value" export cannot be hot-patched.');
  });
});

describe('private members', () => {
  class Vault extends State {}
  const source = 'export class Vault { #key = 1; }\nclass Open {}';
  const flag = 'expressive:private:/src/app.js:Vault';
  const note =
    '[expressive] Vault (/src/app.js) declares #private members, so edits to its module will trigger a full reload. Use _ properties instead to keep HMR.';

  const degrade = (options: Partial<Run> = {}) =>
    run(source, { locals: { Vault, Open: Vault }, before: { Vault: class Vault extends State {}, Open: Vault }, ...options });

  const load = () => run(source, { locals: { Vault, Open: Vault } });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('will note only classes declaring them', async () => {
    const code = await inject('class A { #a; }\nlet B = class { #b() {} };\nclass C { c = 1; }');

    expect(code).toContain('"A": "[expressive] A (/src/app.js)');
    expect(code).toContain('"B": "[expressive] B (/src/app.js)');
    expect(code).not.toContain('"C": "[expressive]');
  });

  it('will warn once, after the reload', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const announce = vi.fn();

    addEventListener('expressive:reload', announce);
    await degrade();
    removeEventListener('expressive:reload', announce);

    expect(announce.mock.calls[0][0].detail.reason).toBe('private members');
    expect(sessionStorage.getItem(flag)).toBe('due');
    expect(warn).not.toHaveBeenCalled();

    await load();

    expect(warn).toHaveBeenCalledWith(note);
    expect(sessionStorage.getItem(flag)).toBe('shown');

    await degrade();
    await load();

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('will warn right away without storage', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.stubGlobal('sessionStorage', {
      getItem() {
        throw new Error('denied');
      }
    });

    await load();
    await degrade();

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(note);
  });

  it('will warn once on the server', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const data = {};

    await run(source, { locals: { Vault, Open: Vault }, ssr: true, data });
    await degrade({ ssr: true, data });
    const last = await degrade({ ssr: true, data });

    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(note.replace('will trigger a full reload', 'replace it instead of patching'));
    expect(last.hot.invalidate).not.toHaveBeenCalled();
  });
});
