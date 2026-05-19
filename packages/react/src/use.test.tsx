import { StrictMode } from 'react';
import { observer } from '@expressive/state';
import { use as useObservable, State } from '.';
import {
  act,
  describe,
  expect,
  it,
  renderHook,
  vi,
  waitFor
} from '../vitest';

describe('use', () => {
  class Test extends State {
    foo = 'foo';
    bar = 'bar';
  }

  it('will subscribe to observable instance', async () => {
    const test = Test.new();
    const didRender = vi.fn();
    const hook = renderHook(() => {
      didRender();
      return useObservable(test).foo;
    });

    expect(hook.result.current).toBe('foo');
    expect(didRender).toBeCalledTimes(1);

    await act(async () => test.set({ foo: 'next' }));

    await waitFor(() => {
      expect(hook.result.current).toBe('next');
    });
  });

  it('will return observed proxy on initial render', () => {
    const test = Test.new();
    let first: Test | undefined;

    renderHook(() => {
      const current = useObservable(test);
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
      useObservable(test).foo;
    }, {
      wrapper: StrictMode
    });

    expect(observer(test)?.listeners.size).toBe(initial + 2);

    hook.unmount();

    expect(observer(test)?.listeners.size).toBe(initial);
  });

  it('will only refresh for accessed values', async () => {
    const test = Test.new();
    const didRender = vi.fn();

    renderHook(() => {
      didRender();
      return useObservable(test).foo;
    });

    expect(didRender).toBeCalledTimes(1);

    const before = didRender.mock.calls.length;

    test.bar = 'next';

    await expect(test).toHaveUpdated();
    expect(didRender).toBeCalledTimes(before);
  });

  it('will activate unready State instance', async () => {
    const test = new Test();

    expect(observer(test)?.ready).toBeUndefined();

    const hook = renderHook(() => useObservable(test).foo);

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
    const didRender = vi.fn();
    let current = first;

    first.foo = 'first';
    second.foo = 'second';

    const hook = renderHook(() => {
      didRender();
      return useObservable(current).foo;
    });

    expect(hook.result.current).toBe('first');
    expect(didRender).toBeCalledTimes(1);

    current = second;

    await act(async () => hook.rerender());

    expect(hook.result.current).toBe('second');
    expect(didRender).toBeCalledTimes(2);

    await act(async () => first.set({ foo: 'stale' }));

    expect(hook.result.current).toBe('second');
    expect(didRender).toBeCalledTimes(2);

    await act(async () => second.set({ foo: 'current' }));

    await waitFor(() => {
      expect(hook.result.current).toBe('current');
    });
  });

  it('will not destroy subject on unmount', async () => {
    const test = Test.new();
    const hook = renderHook(() => useObservable(test).foo);

    await waitFor(() => {
      expect(hook.result.current).toBe('foo');
    });

    hook.unmount();

    expect(test.get(null)).toBe(false);
    expect(() => test.set({ foo: 'next' })).not.toThrow();
  });

  it('will throw for plain object', () => {
    expect(() => renderHook(() => useObservable({}))).toThrow(
      'Provided object is not observable.'
    );
  });

  it('will throw for destroyed observable', () => {
    const test = Test.new();

    test.set(null);

    expect(() => renderHook(() => useObservable(test))).toThrow(
      'Provided object is no longer observable.'
    );
  });
});
