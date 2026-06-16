/** @jsxImportSource preact */
import { StrictMode } from 'preact/compat';
import { event, observer, touch } from '@expressive/mvc';
import { describe, expect, it, mock } from 'bun:test';

import { use, State } from '.';
import { act, renderHook, waitFor } from '@testing-library/preact';

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

    await act(async () => void await test.set({ foo: 'next' }));

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

  it('will not leak subscription under StrictMode', () => {
    // Note: preact's StrictMode is an alias of Fragment, so unlike React
    // there is no double-mount; the key assertion is that unmount returns
    // the listener count to its baseline.
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

    await act(async () => void await test.set({ foo: 'next' }));

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

    await act(async () => void await first.set({ foo: 'stale' }));

    expect(hook.result.current).toBe('second');
    expect(didRender).toHaveBeenCalledTimes(2);

    await act(async () => void await second.set({ foo: 'current' }));

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

});
