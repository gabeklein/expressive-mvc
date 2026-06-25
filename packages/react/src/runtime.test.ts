import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { State, event, observer, touch } from '@expressive/mvc';
import { act, renderHook, waitFor } from '@testing-library/react';

import { Runtime, useHook, use } from './runtime';

// useHook calls useRef, useState, useEffect once each per render. Stub Runtime
// with a hand-driven lifecycle so a subscription update can fire before vs.
// after commit, and watch whether the React setter actually runs.
function harness() {
  const ref = { current: undefined as any };
  let inited = false;
  let state = 0;
  let effect: () => (() => void) | void;
  let refresh: (next?: any) => void;
  const unmount = mock();

  // Apply the updater like React would, so the `(x) => x + 1` path is exercised.
  const update = mock((fn: (prev: number) => number) => void (state = fn(state)));

  Runtime.useRef = ((value: any) => {
    if (ref.current === undefined) ref.current = value;
    return ref;
  }) as typeof Runtime.useRef;

  Runtime.useState = ((value: any) => {
    if (!inited) {
      inited = true;
      if (typeof value === 'function') value(); // run initializer (subscribes)
    }
    return [state, update];
  }) as typeof Runtime.useState;

  Runtime.useEffect = ((fn: any) => void (effect = fn)) as typeof Runtime.useEffect;

  let cleanup: (() => void) | void;

  return {
    update,
    unmount,
    render: () => useHook((r) => ((refresh = r), unmount)),
    commit: () => void (cleanup = effect()),
    unwind: () => cleanup && cleanup(),
    refresh: (next?: any) => refresh(next)
  };
}

let saved: Partial<typeof Runtime>;
beforeEach(() => void (saved = { ...Runtime }));
afterEach(() => void Object.assign(Runtime, saved));

it('does not call the setter before commit', () => {
  const { update, render, refresh } = harness();

  render();
  refresh('early'); // e.g. a sibling mutating shared state during render

  expect(update).not.toHaveBeenCalled();
});

it('coalesces deferred refreshes into a single flush on commit', () => {
  const { update, render, commit, refresh } = harness();

  render();
  refresh('a');
  refresh('b');
  expect(update).not.toHaveBeenCalled();

  commit();
  expect(update).toHaveBeenCalledTimes(1);
});

it('refreshes immediately for updates after commit', () => {
  const { update, render, commit, refresh } = harness();

  render();
  commit();
  update.mockClear();

  refresh('later');
  expect(update).toHaveBeenCalledTimes(1);
});

it('runs the callback cleanup on unmount', () => {
  const { render, commit, unwind, unmount } = harness();

  render();
  commit();
  expect(unmount).not.toHaveBeenCalled();

  unwind();
  expect(unmount).toHaveBeenCalledTimes(1);
});

describe('use', () => {
  class Test extends State {
    foo = 'foo';
    bar = 'bar';
  }

  it('will subscribe to observable instance', async () => {
    const test = Test.new();
    const didRender = mock();
    const hook = renderHook(() => {
      didRender();
      return use(test).foo;
    });

    expect(hook.result.current).toBe('foo');
    expect(didRender).toHaveBeenCalledTimes(1);

    await act(async () => test.set({ foo: 'next' }));

    await waitFor(() => {
      expect(hook.result.current).toBe('next');
    });
  });

  it('will subscribe to custom observable object', async () => {
    class Counter {
      private value = 0;

      get count() {
        return touch(this, 'count', this.value);
      }

      set count(value: number) {
        this.value = value;
        event(this, 'count');
      }

      increment = () => {
        this.count++;
      };
    }

    const counter = new Counter();

    observer(counter, true);

    const hook = renderHook(() => {
      const { count } = use(counter);
      return count;
    });

    expect(hook.result.current).toBe(0);

    await act(async () => counter.increment());

    await waitFor(() => {
      expect(hook.result.current).toBe(1);
    });
  });

  it('will return observed proxy on initial render', () => {
    const test = Test.new();
    let first: Test | undefined;

    renderHook(() => {
      const current = use(test);
      first ??= current;
      void current.foo;
      return current;
    });

    expect(first).not.toBe(test);
  });

  it('will not leak subscription under StrictMode', () => {
    const test = Test.new();
    const initial = observer(test)!.listeners.size;
    const hook = renderHook(() => {
      use(test).foo;
    }, {
      wrapper: StrictMode
    });

    expect(observer(test)?.listeners.size).toBe(initial + 2);

    hook.unmount();

    expect(observer(test)?.listeners.size).toBe(initial);
  });

  it('will only refresh for accessed values', async () => {
    const test = Test.new();
    const didRender = mock();

    renderHook(() => {
      didRender();
      return use(test).foo;
    });

    expect(didRender).toBeCalled();

    const before = didRender.mock.calls.length;

    test.bar = 'next';

    await expect(test).toHaveUpdated();
    expect(didRender).toHaveBeenCalledTimes(before);
  });

  it('will activate unready State instance', async () => {
    const test = new Test();

    expect(observer(test)?.ready).toBeUndefined();

    const hook = renderHook(() => use(test).foo);

    expect(observer(test)?.ready).toBe(true);
    expect(hook.result.current).toBe('foo');

    await waitFor(() => {
      expect(hook.result.current).toBe('foo');
    });

    await act(async () => test.set({ foo: 'next' }));

    await waitFor(() => {
      expect(hook.result.current).toBe('next');
    });
  });

  it('will track replacement observable', async () => {
    const first = Test.new();
    const second = Test.new();
    const didRender = mock();
    let current = first;

    first.foo = 'first';
    second.foo = 'second';

    const hook = renderHook(() => {
      didRender();
      return use(current).foo;
    });

    expect(hook.result.current).toBe('first');
    expect(didRender).toBeCalled();

    current = second;

    await act(async () => hook.rerender());

    expect(hook.result.current).toBe('second');
    expect(didRender).toHaveBeenCalledTimes(2);

    await act(async () => first.set({ foo: 'stale' }));

    expect(hook.result.current).toBe('second');
    expect(didRender).toHaveBeenCalledTimes(2);

    await act(async () => second.set({ foo: 'current' }));

    await waitFor(() => {
      expect(hook.result.current).toBe('current');
    });
  });

  it('will not destroy subject on unmount', async () => {
    const test = Test.new();
    const hook = renderHook(() => use(test).foo);

    await waitFor(() => {
      expect(hook.result.current).toBe('foo');
    });

    hook.unmount();

    expect(test.get(null)).toBe(false);
    expect(() => test.set({ foo: 'next' })).not.toThrow();
  });

  it('will throw for plain object', () => {
    expect(() => renderHook(() => use({}))).toThrow(
      'Provided object is not observable.'
    );
  });

  it('will render last-known values for destroyed observable', () => {
    const test = Test.new();

    test.set(null);

    const hook = renderHook(() => use(test).foo);

    expect(hook.result.current).toBe('foo');
  });

  it('will keep last-known values after subject destroyed', async () => {
    const test = Test.new();
    const hook = renderHook(() => use(test).foo);

    expect(hook.result.current).toBe('foo');

    await act(async () => test.set(null));

    hook.rerender();

    expect(hook.result.current).toBe('foo');
  });
});

