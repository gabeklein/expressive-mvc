import { observer } from '@expressive/mvc';
import { renderHook } from '@solidjs/testing-library';
import { describe, expect, it, mock } from 'bun:test';
import {
  createComponent,
  createMemo,
  createRoot,
  JSX
} from 'solid-js';

import { State, Provider, set, use } from '.';
import { mockPromise } from '../test.setup';

function renderWith<T>(state: State.Type | State, hook: () => T) {
  return renderHook(hook, {
    wrapper: (props: { children: JSX.Element }) =>
      createComponent(Provider, {
        for: state,
        get children() {
          return props.children;
        }
      } as any)
  });
}

describe('State.use', () => {
  class Test extends State {
    value = 'foo';
  }

  it('will create instance given a class', () => {
    const { result } = renderHook(() => Test.use());

    expect(result.is).toBeInstanceOf(Test);
  });

  it('will expose values as signal accessors', () => {
    const { result } = renderHook(() => Test.use());

    expect(result.value()).toBe('foo');

    result.is.value = 'bar';

    expect(result.value()).toBe('bar');
  });

  it('will write through to instance', () => {
    const { result } = renderHook(() => Test.use());

    result.value = 'bar' as any;

    expect(result.is.value).toBe('bar');
    expect(result.value()).toBe('bar');
  });

  it('will accept assign object', () => {
    const { result } = renderHook(() => Test.use({ value: 'bar' }));

    expect(result.value()).toBe('bar');
  });

  it('will run callback argument', () => {
    const callback = mock();
    const { result } = renderHook(() => Test.use(callback));

    expect(callback).toBeCalledWith(result.is);
  });

  it('will call use method with arguments', () => {
    class Test extends State {
      foo = 0;

      use(foo: number) {
        this.foo = foo;
      }
    }

    const { result } = renderHook(() => Test.use(42));

    expect(result.foo()).toBe(42);
  });

  it('will bind methods to instance', () => {
    class Test extends State {
      current = 0;

      action() {
        this.current++;
      }
    }

    const { result } = renderHook(() => Test.use());
    const { action } = result;

    action();

    expect(result.current()).toBe(1);
  });

  it('will destroy instance on cleanup', () => {
    const didDestroy = mock();

    class Test extends State {
      value = 'foo';

      protected new() {
        return didDestroy;
      }
    }

    const { result, cleanup } = renderHook(() => Test.use());

    cleanup();

    expect(didDestroy).toBeCalled();
    expect(() => (result.is.value = 'bar')).toThrow();
  });

  it('will update fine-grained', () => {
    class Test extends State {
      foo = 1;
      bar = 2;
      baz = 3;
    }

    const { result } = renderHook(() => Test.use());
    const observedFoo = mock(() => result.foo());

    createRoot((dispose) => {
      createMemo(observedFoo);

      expect(observedFoo).toBeCalledTimes(1);

      // unrelated update - bar was never accessed
      result.is.bar = 20;

      expect(observedFoo).toBeCalledTimes(1);

      // accessed but untracked by the memo
      expect(result.baz()).toBe(3);
      result.is.baz = 30;

      expect(observedFoo).toBeCalledTimes(1);

      result.is.foo = 10;

      expect(observedFoo).toBeCalledTimes(2);

      dispose();
    });
  });

  it('will pass through symbols and is', () => {
    const { result } = renderHook(() => Test.use());

    expect((result as any)[Symbol.toPrimitive]).toBeUndefined();
    expect(result.is.value).toBe('foo');
  });

  it('will not duplicate subscriptions', () => {
    const { result } = renderHook(() => Test.use());
    const instance = result.is;
    const count = observer(instance)!.listeners.size;

    // same proxy is reused, repeat access adds no listeners
    expect(use(instance)).toBe(result);

    void result.value();
    void result.value();

    expect(observer(instance)!.listeners.size).toBe(count);
  });
});

describe('State.get', () => {
  class Test extends State {
    foo = 1;
    bar = 2;
  }

  it('will return reactive proxy from context', () => {
    const { result } = renderWith(Test, () => Test.get());

    expect(result.is).toBeInstanceOf(Test);
    expect(result.foo()).toBe(1);

    result.is.foo = 3;

    expect(result.foo()).toBe(3);
  });

  it('will return same proxy for same instance', () => {
    const { result } = renderWith(Test, () => [Test.get(), Test.get()]);

    expect(result[0]).toBe(result[1]);
  });

  it('will throw if not found in context', () => {
    expect(() => renderHook(() => Test.get())).toThrow(
      'Could not find Test in context.'
    );
  });

  describe('passing false', () => {
    it('will return undefined if not found', () => {
      const { result } = renderHook(() => Test.get(false));

      expect(result).toBeUndefined();
    });

    it('will return proxy if found', () => {
      const { result } = renderWith(Test, () => Test.get(false));

      expect(result!.is).toBeInstanceOf(Test);
    });
  });

  describe('passing true', () => {
    class Test extends State {
      value?: string = undefined;
      foo = 'bar';
    }

    it('will return values where defined', () => {
      const { result } = renderWith(Test, () => Test.get(true));

      expect(result.foo()).toBe('bar');
      // accessor is cached per-key
      expect(result.foo).toBe(result.foo);
    });

    it('will throw if accessed value is undefined', () => {
      const { result } = renderWith(Test, () => Test.get(true));

      expect(() => result.value()).toThrow('is required in this context');
    });

    it('will stop throwing once value is defined', () => {
      const { result } = renderWith(Test, () => Test.get(true));

      result.is.value = 'baz';

      expect(result.value()).toBe('baz');
    });
  });

  describe('factory', () => {
    it('will compute and update when dependencies change', async () => {
      const test = Test.new();
      const { result } = renderWith(test, () =>
        Test.get((current) => current.foo + current.bar)
      );

      expect(result()).toBe(3);

      test.foo = 2;

      await expect(test).toHaveUpdated();

      expect(result()).toBe(4);
    });

    it('will notify subscribers of accessor', async () => {
      const test = Test.new();
      const { result } = renderWith(test, () =>
        Test.get((current) => current.foo)
      );
      const observed = mock(() => result());

      createRoot(() => createMemo(observed));

      expect(observed).toBeCalledTimes(1);

      test.foo = 5;

      await expect(test).toHaveUpdated();

      expect(observed).toBeCalledTimes(2);
      expect(result()).toBe(5);
    });

    it('will not update if factory returns same value', async () => {
      const test = Test.new();
      const factory = mock((current: Test) => (current.foo, 'constant'));
      const { result } = renderWith(test, () => Test.get(factory));

      expect(result()).toBe('constant');

      test.foo = 9;

      await expect(test).toHaveUpdated();

      expect(factory).toBeCalledTimes(2);
      expect(result()).toBe('constant');
    });

    it('will return null if factory returns undefined', () => {
      const { result } = renderWith(Test, () => Test.get(() => undefined));

      expect(result()).toBeNull();
    });

    it('will release on cleanup', async () => {
      const test = Test.new();
      const factory = mock((current: Test) => current.foo);
      const { cleanup } = renderWith(test, () => Test.get(factory));

      cleanup();

      test.foo = 4;

      await expect(test).toHaveUpdated();

      expect(factory).toBeCalledTimes(1);
    });

    it('will run once as effect if null is returned', async () => {
      const test = Test.new();
      const effect = mock((current: Test) => (current.foo, null));
      const { result } = renderWith(test, () => Test.get(effect));

      expect(result()).toBeNull();

      test.foo = 8;

      await expect(test).toHaveUpdated();

      expect(effect).toBeCalledTimes(1);
    });

    it('will resolve async factory via signal', async () => {
      const promise = mockPromise<string>();
      const { result } = renderWith(Test, () => Test.get(() => promise));

      expect(result()).toBeNull();

      promise.resolve('hello');

      await promise;
      await new Promise((res) => setTimeout(res, 0));

      expect(result()).toBe('hello');
    });

    it('will throw from accessor if async factory rejects', async () => {
      const promise = mockPromise<string>();
      const { result } = renderWith(Test, () => Test.get(() => promise));

      expect(result()).toBeNull();

      promise.reject(new Error('oh no'));

      await promise.catch(() => {});
      await new Promise((res) => setTimeout(res, 0));

      expect(() => result()).toThrow('oh no');
    });

    it('will suspend on undefined required values', async () => {
      class Test extends State {
        value = set<string>();
      }

      const test = Test.new();
      const { result } = renderWith(test, () =>
        Test.get((current) => current.value)
      );

      // factory suspended on `value` - accessor returns null meanwhile
      expect(result()).toBeNull();

      test.value = 'finally';

      await expect(test).toHaveUpdated();

      expect(result()).toBe('finally');
    });

    describe('refresh', () => {
      it('will notify subscribers on demand', () => {
        const external = { count: 0 };
        let refresh!: State.ForceRefresh;

        const { result } = renderWith(Test, () =>
          Test.get((_, forceUpdate) => {
            refresh = forceUpdate;
            return external.count;
          })
        );

        const observed = mock(() => result());

        createRoot(() => createMemo(observed));

        expect(observed).toBeCalledTimes(1);

        refresh();

        expect(observed).toBeCalledTimes(2);
      });

      it('will notify again when promise settles', async () => {
        const promise = mockPromise<string>();
        let refresh!: State.ForceRefresh;

        const { result } = renderWith(Test, () =>
          Test.get((_, forceUpdate) => {
            refresh = forceUpdate;
            return 'value';
          })
        );

        const observed = mock(() => result());

        createRoot(() => createMemo(observed));

        expect(observed).toBeCalledTimes(1);

        const output = refresh(promise);

        expect(observed).toBeCalledTimes(2);

        promise.resolve('done');

        await expect(output).resolves.toBe('done');
        await new Promise((res) => setTimeout(res, 0));

        expect(observed).toBeCalledTimes(3);
      });

      it('will invoke async function', async () => {
        let refresh!: State.ForceRefresh;

        renderWith(Test, () =>
          Test.get((_, forceUpdate) => {
            refresh = forceUpdate;
            return 'value';
          })
        );

        const action = mock(async () => 'result');

        await expect(refresh(action)).resolves.toBe('result');
        expect(action).toBeCalled();
      });
    });
  });
});
