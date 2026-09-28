import { parseAst } from 'vite';
import { describe, expect, it, vi } from 'vitest';

import expressive from './vite';

type Result = Promise<{ code: string; map: null } | undefined>;

function transform(code: string, id = '/src/app.js', runtime: string | null = '/mvc/src/runtime.js'): Result {
  const hook = expressive().transform as Function;
  const resolve = async () => runtime && { id: runtime };

  return hook.call({ parse: parseAst, resolve }, code, id);
}

async function inject(code: string) {
  return (await transform(code))!.code.slice(code.length);
}

async function judge(
  code: string,
  locals: Record<string, unknown>,
  next: Record<string, unknown> | undefined,
  page = true
) {
  const location = page ? { reload: vi.fn() } : undefined;
  const output = await inject(code);
  const block = output.slice(output.indexOf('if (import.meta.hot)')).replaceAll('import.meta.hot', 'hot');
  const hot = { accept: vi.fn(), invalidate: vi.fn() };

  new Function('hot', 'location', ...Object.keys(locals), block)(hot, location, ...Object.values(locals));
  hot.accept.mock.calls[0][0](next);

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
  const resolve = vi.fn(async () => ({ id: '/mvc/src/runtime.js' }));
  const hook = expressive().transform as Function;
  const context = { parse: parseAst, resolve };

  await hook.call(context, 'class A {}', '/src/a.js');
  await hook.call(context, 'class B {}', '/src/b.js');

  expect(resolve).toHaveBeenCalledTimes(1);
});

it('will append the binding and keep source maps', async () => {
  const { code, map } = (await transform('class A {}', '/src/app.js?t=123'))!;

  expect(code).toContain(`import { hot as __expressive } from '@expressive/mvc/runtime';`);
  expect(code).toContain('__expressive.accept("/src/app.js", { A })');
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
    expect(await exports('export default Store;')).toBe('"default": Store');
    expect(await exports('export default function App() {}')).toBe('"default": App');
  });

  it('will not record an anonymous default', async () => {
    expect(await exports('export default function () {}')).toBe('');
  });
});

describe('update', () => {
  class Store {}
  const App = () => null;
  const source = 'export class Store {}\nexport const App = () => null;\nexport let value = 1;';

  it('will pass without next exports', async () => {
    const { hot, location } = await judge(source, { Store, App, value: 1 }, undefined);

    expect(hot.invalidate).not.toHaveBeenCalled();
    expect(location.reload).not.toHaveBeenCalled();
  });

  it('will pass a kept class', async () => {
    const { hot, location } = await judge(source, { Store, App, value: 1 }, { Store, App, value: 1 });

    expect(hot.invalidate).not.toHaveBeenCalled();
    expect(location.reload).not.toHaveBeenCalled();
  });

  it('will invalidate a changed component', async () => {
    const { hot } = await judge(source, { Store, App, value: 1 }, { Store, App: () => null, value: 1 });

    expect(hot.invalidate).toHaveBeenCalledWith('"App" export cannot be hot-patched.');
  });

  it('will reload for a replaced class', async () => {
    const { location } = await judge(source, { Store, App, value: 1 }, { Store: class Store {}, App, value: 1 });

    expect(location.reload).toHaveBeenCalled();
  });

  it('will invalidate a replaced class where there is no page', async () => {
    const { hot } = await judge(source, { Store, App, value: 1 }, { Store: class Store {}, App, value: 1 }, false);

    expect(hot.invalidate).toHaveBeenCalledWith();
  });

  it('will invalidate another changed export', async () => {
    const { hot } = await judge(source, { Store, App, value: 1 }, { Store, App, value: 2 });

    expect(hot.invalidate).toHaveBeenCalledWith('"value" export cannot be hot-patched.');
  });
});
