import { event, listener, touch } from '../../state/src/observable';
import { State, use } from '.';
import {
  vi,
  expect,
  it,
  describe,
  act,
  renderHook,
  mockPromise
} from '../vitest';

describe('use', () => {
  class Test extends State {
    foo = 'foo';
    bar = 'bar';
  }

  it('will observe state by reference', async () => {
    const test = Test.new();
    const didRender = vi.fn();
    const hook = renderHook(() => {
      didRender();
      return use(test).foo;
    });

    expect(hook.result.current).toBe('foo');
    expect(didRender).toBeCalledTimes(1);

    await act(async () => {
      test.foo = 'baz';
    });

    expect(hook.result.current).toBe('baz');
    expect(didRender).toBeCalledTimes(2);
  });

  it('will resubscribe when reference changes', async () => {
    const first = Test.new({ foo: 'first' });
    const second = Test.new({ foo: 'second' });
    const didRender = vi.fn();

    const hook = renderHook(
      ({ state }) => {
        didRender();
        return use(state).foo;
      },
      { initialProps: { state: first } }
    );

    expect(hook.result.current).toBe('first');
    expect(didRender).toBeCalledTimes(1);

    hook.rerender({ state: second });

    expect(hook.result.current).toBe('second');
    expect(didRender).toBeCalledTimes(2);

    first.foo = 'stale';
    await expect(first).toHaveUpdated('foo');

    expect(hook.result.current).toBe('second');
    expect(didRender).toBeCalledTimes(2);

    await act(async () => {
      second.foo = 'updated';
    });

    expect(hook.result.current).toBe('updated');
    expect(didRender).toBeCalledTimes(3);
  });

  it('will select and subscribe to subvalue', async () => {
    const test = Test.new();
    const didRender = vi.fn();
    const hook = renderHook(() => {
      didRender();
      return use(test, ($) => $.foo);
    });

    expect(hook.result.current).toBe('foo');

    test.bar = 'ignored';
    await expect(test).toHaveUpdated('bar');

    expect(hook.result.current).toBe('foo');
    expect(didRender).toBeCalledTimes(1);

    await act(async () => {
      test.foo = 'baz';
    });

    expect(hook.result.current).toBe('baz');
    expect(didRender).toBeCalledTimes(2);
  });

  it('will switch observer mode for same reference', () => {
    const test = Test.new();
    const hook = renderHook(
      ({ required }) => {
        if (required) return use(test, true).foo;
        return use(test).foo;
      },
      { initialProps: { required: false } }
    );

    expect(hook.result.current).toBe('foo');

    hook.rerender({ required: true });

    expect(hook.result.current).toBe('foo');
  });

  it('will ignore updates with same selected result', async () => {
    const test = Test.new();
    const compute = vi.fn();
    const didRender = vi.fn();

    renderHook(() => {
      didRender();
      return use(test, ($) => {
        compute();
        void $.foo;
        return $.bar;
      });
    });

    expect(compute).toBeCalledTimes(1);
    expect(didRender).toBeCalledTimes(1);

    test.foo = 'baz';
    await expect(test).toHaveUpdated('foo');

    expect(compute).toBeCalledTimes(2);
    expect(didRender).toBeCalledTimes(1);
  });

  it('will stop observing if selector returns null', async () => {
    const test = Test.new();
    const didRender = vi.fn();
    const compute = vi.fn(($: Test) => {
      void $.foo;
      return null;
    });

    const hook = renderHook(() => {
      didRender();
      return use(test, compute);
    });

    expect(hook.result.current).toBe(null);
    expect(didRender).toBeCalledTimes(1);

    test.foo = 'baz';
    await expect(test).toHaveUpdated('foo');

    expect(compute).toBeCalledTimes(1);
    expect(didRender).toBeCalledTimes(1);
  });

  it('will refresh manually from selector', async () => {
    const test = Test.new();
    const promise = mockPromise();
    const later = mockPromise();
    const didRender = vi.fn();
    let refresh!: State.ForceRefresh;

    renderHook(() => {
      didRender();
      return use(test, (_, force) => {
        refresh = force;
        return null;
      });
    });

    expect(didRender).toBeCalledTimes(1);

    act(() => refresh());

    expect(didRender).toBeCalledTimes(2);

    await act(async () => {
      refresh(() => promise);
    });

    expect(didRender).toBeCalledTimes(3);

    await act(async () => {
      promise.resolve();
    });

    expect(didRender).toBeCalledTimes(4);

    await act(async () => {
      refresh(later);
    });

    expect(didRender).toBeCalledTimes(5);

    await act(async () => {
      later.resolve();
    });

    expect(didRender).toBeCalledTimes(6);
  });

  it('will resolve async selector', async () => {
    const test = Test.new();
    const promise = mockPromise<string>();
    const hook = renderHook(() => use(test, () => promise));

    expect(hook.result.current).toBe(null);

    await act(async () => {
      promise.resolve('done');
    });

    expect(hook.result.current).toBe('done');
  });

  it('will throw if async selector rejects', async () => {
    const test = Test.new();
    const promise = mockPromise<string>();
    const hook = renderHook(() => {
      try {
        return use(test, () => promise);
      } catch (err) {
        return err;
      }
    });

    expect(hook.result.current).toBe(null);

    await act(async () => {
      promise.reject('oh no');
    });

    expect(hook.result.current).toBe('oh no');
  });

  it('will ignore stale async selector result after reference changes', async () => {
    const first = Test.new();
    const second = Test.new();
    const firstPromise = mockPromise<string>();
    const secondPromise = mockPromise<string>();
    const hook = renderHook(
      ({ state, promise }) => use(state, () => promise),
      { initialProps: { state: first, promise: firstPromise } }
    );

    expect(hook.result.current).toBe(null);

    hook.rerender({ state: second, promise: secondPromise });

    await act(async () => {
      firstPromise.resolve('stale');
    });

    expect(hook.result.current).toBe(null);

    await act(async () => {
      secondPromise.resolve('fresh');
    });

    expect(hook.result.current).toBe('fresh');
  });

  it('will ignore stale async selector rejection after reference changes', async () => {
    const first = Test.new();
    const second = Test.new();
    const firstPromise = mockPromise<string>();
    const secondPromise = mockPromise<string>();
    const hook = renderHook(
      ({ state, promise }) => {
        try {
          return use(state, () => promise);
        } catch (err) {
          return err;
        }
      },
      { initialProps: { state: first, promise: firstPromise } }
    );

    expect(hook.result.current).toBe(null);

    hook.rerender({ state: second, promise: secondPromise });

    await act(async () => {
      firstPromise.reject('stale');
    });

    expect(hook.result.current).toBe(null);

    await act(async () => {
      secondPromise.resolve('fresh');
    });

    expect(hook.result.current).toBe('fresh');
  });

  it('will observe an Observable object', async () => {
    class Counter {
      count = 0;

      constructor() {
        listener(this, () => {});
        event(this);
      }

      read() {
        return touch(this, 'count', this.count);
      }

      increment() {
        this.count++;
        event(this, 'count');
      }
    }

    const counter = new Counter();
    const hook = renderHook(() => use(counter).read());

    expect(hook.result.current).toBe(0);

    await act(async () => {
      counter.increment();
    });

    expect(hook.result.current).toBe(1);
  });

  it('will refresh when target becomes ready after mount', async () => {
    const test = new Test();
    const hook = renderHook(() => use(test));

    expect(hook.result.current).toBe(null);

    await act(async () => {
      event(test);
    });

    expect(hook.result.current.foo).toBe('foo');
  });

  it('will enforce required values', () => {
    class Test extends State {
      value?: string = undefined;
    }

    const test = Test.new();

    renderHook(() => {
      expect(() => {
        void use(test, true).value;
      }).toThrow(/[\w-]+\.value is required in this context\./);
    });
  });

  it('will return undefined without a target', () => {
    const hook = renderHook(() => use<Test>(undefined));

    expect(hook.result.current).toBeUndefined();
  });

  it('will throw for non-observable objects', () => {
    expect(() => renderHook(() => use({}))).toThrow(
      'use() expects a State or Observable object.'
    );
  });
});
