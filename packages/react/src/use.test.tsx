import { StrictMode } from 'react';
import { event, observer, touch } from '@expressive/mvc';
import { describe, expect, it, mock } from 'bun:test';

import { use, State } from '.';
import { act, renderHook, waitFor } from '@testing-library/react';

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

    expect(didRender).toHaveBeenCalledTimes(1);

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
    expect(didRender).toHaveBeenCalledTimes(1);

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
