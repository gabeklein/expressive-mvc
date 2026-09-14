import { describe, expect, it } from 'vitest';

import { mockPromise } from '../test.setup';
import { lazy } from './lazy';
import { isVNode } from './vnode';

describe('lazy', () => {
  it('will suspend once and render a default export', async () => {
    const loaded = mockPromise<{ default: () => null }>();
    const load = () => loaded;
    const Lazy = lazy(load);
    let pending!: Promise<unknown>;

    try {
      Lazy({});
    } catch (error) {
      pending = error as Promise<unknown>;
    }

    expect(() => Lazy({})).toThrow(pending);
    loaded.resolve({ default: () => null });
    await pending;

    const node = Lazy({});
    expect(isVNode(node)).toBe(true);
  });

  it('will render a directly exported component', async () => {
    const loaded = mockPromise<(props: { value: number }) => number>();
    const Lazy = lazy(() => loaded);
    let pending!: Promise<unknown>;

    try {
      Lazy({ value: 2 });
    } catch (error) {
      pending = error as Promise<unknown>;
    }

    loaded.resolve(({ value }) => value);
    await pending;
    expect(Lazy({ value: 2 })).toMatchObject({ props: { value: 2 } });
  });

  it('will preserve a falsy rejection', async () => {
    const loaded = mockPromise<() => null>();
    const Lazy = lazy(() => loaded);
    let pending!: Promise<unknown>;

    try {
      Lazy({});
    } catch (error) {
      pending = error as Promise<unknown>;
    }

    loaded.reject(0);
    await pending;
    expect(() => Lazy({})).toThrow(0);
  });
});
