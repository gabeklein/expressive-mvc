import { describe, expect, it } from 'vitest';

import { mockPromise } from '../test.setup';
import { resolve } from './loader';
import { isVNode } from './vnode';

function suspend(type: Function, run: () => unknown) {
  try {
    resolve(type, {}, run);
  } catch (error) {
    return error as Promise<unknown>;
  }
}

describe('resolve', () => {
  it('will return output which is not a promise', () => {
    const Plain = () => 'text';

    expect(resolve(Plain, {}, Plain)).toBe('text');
    expect(resolve(Plain, {}, () => null)).toBeNull();
  });

  it('will suspend once and render a default export', async () => {
    const loaded = mockPromise<{ default: () => null }>();
    const Loader = () => loaded;
    const pending = suspend(Loader, Loader)!;

    expect(() => resolve(Loader, {}, Loader)).toThrow(pending);
    loaded.resolve({ default: () => null });
    await pending;

    expect(isVNode(resolve(Loader, {}, Loader))).toBe(true);
  });

  it('will render a directly exported component with props', async () => {
    const loaded = mockPromise<(props: { value: number }) => number>();
    const Loader = () => loaded;
    const pending = suspend(Loader, Loader)!;

    loaded.resolve(({ value }) => value);
    await pending;
    expect(resolve(Loader, { value: 2 }, Loader)).toMatchObject({ props: { value: 2 } });
  });

  it('will throw a falsy rejection', async () => {
    const loaded = mockPromise<() => null>();
    const Loader = () => loaded;
    const pending = suspend(Loader, Loader)!;

    loaded.reject(0);
    await pending;
    expect(() => resolve(Loader, {}, Loader)).toThrow(0);
  });

  it('will throw if a module has no component', async () => {
    const loaded = mockPromise<any>();
    const Loader = () => loaded;
    const pending = suspend(Loader, Loader)!;

    loaded.resolve(undefined);
    await pending;
    expect(() => resolve(Loader, {}, Loader)).toThrow('Loader resolved no component.');
  });

  it('will load again after a rejection', async () => {
    const attempts = [mockPromise<() => null>(), mockPromise<() => null>()];
    let calls = 0;
    const Loader = () => attempts[calls++];
    const first = suspend(Loader, Loader)!;

    attempts[0].reject(new Error('chunk'));
    await first;

    expect(() => resolve(Loader, {}, Loader)).toThrow('chunk');

    const second = suspend(Loader, Loader)!;

    expect(second).not.toBe(first);
    expect(calls).toBe(2);

    attempts[1].resolve(() => null);
    await second;

    expect(isVNode(resolve(Loader, {}, Loader))).toBe(true);
  });
});
