import { describe, expect, it } from 'vitest';
import { State } from '@expressive/mvc';

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

  it('will reject with a falsy error', async () => {
    const loaded = mockPromise<() => null>();
    const Lazy = lazy(() => loaded);
    let pending!: Promise<unknown>;

    try {
      Lazy({});
    } catch (error) {
      pending = error as Promise<unknown>;
    }

    loaded.reject(0);
    await expect(pending).rejects.toBe(0);
  });

  it('will reject a module with no component', async () => {
    const loaded = mockPromise<any>();
    const Lazy = lazy(() => loaded);
    let pending!: Promise<unknown>;

    try {
      Lazy({});
    } catch (error) {
      pending = error as Promise<unknown>;
    }

    loaded.resolve({});
    await expect(pending).rejects.toThrow('lazy() loader resolved no component.');
  });

  it('will load again after a rejection', async () => {
    const attempts = [mockPromise<() => null>(), mockPromise<() => null>()];
    let calls = 0;
    const Lazy = lazy(() => attempts[calls++]);
    const suspend = () => {
      try {
        Lazy({});
      } catch (error) {
        return error as Promise<unknown>;
      }
    };

    const first = suspend()!;

    attempts[0].reject(new Error('chunk'));
    await expect(first).rejects.toThrow('chunk');

    const second = suspend()!;

    expect(second).not.toBe(first);
    expect(calls).toBe(2);

    attempts[1].resolve(() => null);
    await second;

    expect(isVNode(Lazy({}))).toBe(true);
  });

  it('will type attributes from the loaded component', () => {
    class Settings extends State {
      theme = 'dark';
    }

    const Fn = (props: { size: number }) => props.size;
    const LazyState = lazy(() => Promise.resolve({ default: Settings }));
    const LazyFn = lazy(() => Promise.resolve(Fn));

    void (() => [
      LazyState({ theme: 'light' }),
      LazyFn({ size: 1 }),
      // @ts-expect-error
      LazyState({ theme: 1 }),
      // @ts-expect-error
      LazyFn({ size: 'x' })
    ]);
  });
});
