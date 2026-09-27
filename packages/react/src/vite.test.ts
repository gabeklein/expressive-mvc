import { parseAst } from 'vite';
import { describe, expect, it, vi } from 'vitest';

import expressive from './vite';

type Result = Promise<{ code: string; map: null } | undefined>;

function transform(code: string, id = '/src/app.js', runtime: string | null = '/mvc/src/runtime.js'): Result {
  const hook = expressive().transform as Function;
  const resolve = async () => runtime && { id: runtime };

  return hook.call({ parse: parseAst, resolve }, code, id);
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

describe('classes', () => {
  it('will bind top-level classes', async () => {
    const { code } = (await transform('class A {}\nlet B = class {};\nvar C = class {};'))!;

    expect(code).toContain('__expressive.accept("/src/app.js", { A, B, C })');
    expect(code).toContain('A = __hot.A;');
    expect(code).toContain('B = __hot.B;');
  });

  it('will not bind a class it cannot reassign', async () => {
    const { code } = (await transform('class A {}\nconst B = class {};\nlet c = 1, [d] = [2];'))!;

    expect(code).toContain('{ A }');
  });

  it('will bind exported classes', async () => {
    const { code } = (await transform('export class A {}\nexport default class B {}'))!;

    expect(code).toContain('{ A, B }');
    expect(code).toContain('const __exports = { "A": A, "default": B };');
  });

  it('will strip the query from the module id', async () => {
    const { code } = (await transform('class A {}', '/src/app.js?t=123'))!;

    expect(code).toContain('accept("/src/app.js",');
  });

  it('will preserve source maps', async () => {
    expect((await transform('class A {}'))!.map).toBeNull();
  });
});

describe('exports', () => {
  const exports = async (code: string) =>
    (await transform(`class Store {}\n${code}`))!.code.match(/const __exports = \{ (.*) \};/)![1];

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
