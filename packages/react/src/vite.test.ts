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

it('will append the hot binding', async () => {
  const { code, map } = (await transform('class A {}', '/src/app.js?t=123'))!;

  expect(code).toContain('__expressive.accept("/src/app.js", { A })');
  expect(map).toBeNull();
});
