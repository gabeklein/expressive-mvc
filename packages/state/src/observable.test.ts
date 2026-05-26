import { event, listener, touch, watch, observer } from './observable';
import { set } from './instruction/set';
import { def } from './instruction/def';
import { mock, describe, it, expect } from 'bun:test';
import { mockError, mockPromise } from '../test.setup';
import { State } from './state';

describe('effect', () => {
  it('will remove listener on cleanup', () => {
    const test = {};

    event(test);

    const done = watch(test, () => { });

    expect(observer(test)?.listeners.size).toBeGreaterThan(0);

    done();

    expect(observer(test)?.listeners.size).toBe(0);
  });

  it('will cleanup safely while suspended', async () => {
    let shouldSuspend = true;
    const pending = mockPromise();

    class Test extends State {
      value = 1;
    }

    const test = Test.new();
    const done = watch(test, () => {
      if (shouldSuspend) {
        shouldSuspend = false;
        throw pending;
      }

      return null;
    });

    expect(done).not.toThrow();

    pending.resolve();
    await pending;
  });

  it('will run after properties', () => {
    const cb = mock();

    class Test extends State {
      property = def((_key, _state, state) => {
        this.get(() => cb(state));
      });

      foo = 1;
      bar = 2;
    }

    Test.new();

    expect(cb).toBeCalledWith({ foo: 1, bar: 2 });
  });

  it('will enforce values if required', () => {
    class Test extends State {
      property?: string = undefined;
    }

    const test = Test.new();
    const attempt = () => {
      watch(
        test,
        ($) => {
          expect<string>($.property);
        },
        true
      );
    };

    expect(attempt).toThrow(/[\w-]+\.property is required in this context\./);
  });

  it('will not enforce required for value-less touch', () => {
    class Test extends State {
      property = 'value';
    }

    const test = Test.new();

    expect(() =>
      watch(
        test,
        ($) => {
          touch($, 'signal');
          void $.property;
        },
        true
      )
    ).not.toThrow();

    expect(() =>
      watch(
        test,
        ($) => {
          touch($, 'signal', undefined);
        },
        true
      )
    ).toThrow(/\.signal is required in this context\./);
  });

  it('will still get events after silent ones', async () => {
    class Test extends State {
      value1 = 1;
      value2 = 2;
    }

    const test = Test.new();
    const didGetValue = mock();

    test.get(($) => {
      didGetValue($.value1, $.value2);
    });

    expect(didGetValue).toBeCalledWith(1, 2);

    test.set({ value1: 10 }, true);
    test.set({ value2: 20 });

    await expect(test).toHaveUpdated();

    expect(didGetValue).toBeCalledWith(10, 20);
    expect(didGetValue).toBeCalledTimes(2);
  });

  it('will pass changed keys to callback', async () => {
    class Test extends State {
      foo = 1;
      bar = 2;
    }

    const test = Test.new();
    const calls = [] as Array<readonly State.Signal[] | undefined>;

    watch(test, ($, changed) => {
      calls.push(changed);
      void $.foo;
      void $.bar;
    });

    expect(calls[0]).toEqual([]);

    test.foo = 3;
    await expect(test).toHaveUpdated('foo');
    expect(calls[1]).toEqual(['foo']);

    test.foo = 4;
    test.bar = 5;
    await expect(test).toHaveUpdated('foo', 'bar');
    expect(calls[2]).toEqual(['foo', 'bar']);

    test.bar = 6;
    await expect(test).toHaveUpdated('bar');
    expect(calls[3]).toEqual(['bar']);
  });

  it('will cleanup nested effects', async () => {
    class Test extends State {
      foo = 1;
      bar = 2;
    }

    const test = Test.new();
    const didInvoke = mock();

    const done = watch(test, ({ foo }) => {
      watch(test, ({ bar }) => {
        didInvoke({ foo, bar });
      });
    });

    expect(didInvoke).toBeCalledTimes(1);
    expect(didInvoke).toBeCalledWith({ foo: 1, bar: 2 });

    await test.set({ bar: 3 });

    expect(didInvoke).toBeCalledWith({ foo: 1, bar: 3 });

    await test.set({ foo: 2, bar: 4 });

    expect(didInvoke).toBeCalledWith({ foo: 2, bar: 4 });
    expect(didInvoke).not.toBeCalledWith({ foo: 1, bar: 4 });

    await test.set({ bar: 2 });

    expect(didInvoke).toBeCalledWith({ foo: 2, bar: 2 });

    done();

    await test.set({ bar: 1 });

    expect(didInvoke).not.toBeCalledWith({ foo: 2, bar: 1 });
    expect(didInvoke).toBeCalledTimes(4);
  });

  it('will call cleanup before re-running effect', async () => {
    class Test extends State {
      value = 1;
    }

    const effect = mock();
    const cleanup = mock();
    const test = Test.new();

    watch(test, ($) => {
      effect($.value);
      return cleanup;
    });

    expect(effect).toBeCalledWith(1);
    expect(cleanup).not.toBeCalled();

    await test.set({ value: 2 });

    expect(effect).toBeCalledWith(2);
    expect(effect).toBeCalledWith(2);

    expect(cleanup).toBeCalledTimes(1);
    expect(cleanup).toBeCalledWith(true);
  });

  it('will ignore circular update', async () => {
    class Test extends State {
      foo = 1;
      bar?: number = undefined;
    }

    const didUpdate = mock();
    const test = Test.new();

    watch(test, ({ foo, bar }) => {
      didUpdate(foo, bar);
      test.bar = foo;
    });

    expect(didUpdate).toBeCalledTimes(1);
    expect(didUpdate).toBeCalledWith(1, undefined);

    // is syncronously 1 after effect did run.
    expect(test.bar).toBe(1);

    // flush events to check if effect updates.
    await expect(test).toHaveUpdated('bar');
    expect(didUpdate).not.toBeCalledWith(1, 1);

    test.foo = 2;
    await expect(test).toHaveUpdated('foo');
    expect(didUpdate).toBeCalledWith(2, 1);

    expect(didUpdate).toBeCalledTimes(2);
    expect(test.bar).toBe(2);

    test.foo = 3;
    await expect(test).toHaveUpdated('foo');

    expect(didUpdate).toBeCalledTimes(3);
    expect(test.bar).toBe(3);
  });

  it('will ignore circular update', async () => {
    class Test extends State {
      foo = 1;
      bar?: number = undefined;
    }

    const didUpdate = mock();
    const test = Test.new();

    watch(test, ({ foo, bar }) => {
      didUpdate(foo, bar);
      test.bar = foo;
    });

    expect(didUpdate).toBeCalledTimes(1);
    expect(didUpdate).toBeCalledWith(1, undefined);

    // is syncronously 1 after effect did run.
    expect(test.bar).toBe(1);

    // flush events to check if effect updates.
    await expect(test).toHaveUpdated('bar');
    expect(didUpdate).not.toBeCalledWith(1, 1);

    test.foo = 2;
    await expect(test).toHaveUpdated('foo');
    expect(didUpdate).toBeCalledWith(2, 1);

    expect(didUpdate).toBeCalledTimes(2);
    expect(test.bar).toBe(2);

    test.foo = 3;
    await expect(test).toHaveUpdated('foo');

    expect(didUpdate).toBeCalledTimes(3);
    expect(test.bar).toBe(3);
  });

  it('will override circular update', async () => {
    class Test extends State {
      foo = 1;
      bar?: number = undefined;
    }

    const test = Test.new();

    watch(test, ({ foo, bar = 0 }) => {
      test.bar = foo + bar;
    });

    expect(test.bar).toBe(1);

    test.bar = 2;
    expect(test.bar).toBe(2);

    await expect(test).toHaveUpdated('bar');
    expect(test.bar).toBe(3);
  });
});

describe('suspense', () => {
  it('will seem to throw error outside react', () => {
    class Test extends State {
      value = set<never>();
    }

    const instance = Test.new();
    let didThrow: Error | undefined;

    try {
      void instance.value;
    } catch (err: any) {
      didThrow = err;
    }

    expect(String(didThrow)).toMatch(/[\w-]+\.value is not yet available\./);
  });

  it('will reject if state destroyed before resolved', async () => {
    class Test extends State {
      value = set<never>();
    }

    const instance = Test.new();
    let didThrow: Promise<any> | undefined;

    try {
      void instance.value;
    } catch (err: any) {
      didThrow = err;
    }

    instance.set(null);

    await expect(didThrow).rejects.toThrow(/[\w-]+ is destroyed\./);
  });
});

describe('errors', () => {
  const error = mockError();

  it('will throw sync error to the console', async () => {
    class Test extends State {
      value = 1;
    }

    const test = Test.new();

    test.set(() => {
      throw new Error('sync error');
    });

    const attempt = () => (test.value = 2);

    expect(attempt).toThrow(`sync error`);
  });

  it('will log async error to the console', async () => {
    class Test extends State {
      value = 1;
    }

    const expected = new Error('async error');
    const test = Test.new();

    test.get(($) => {
      if ($.value == 2) throw expected;
    });

    test.value = 2;

    await expect(test).toHaveUpdated();

    expect(error).toBeCalledWith(expected);
  });
});

describe('observable', () => {
  it('will dispatch from a plain class using touch and event', async () => {
    class Counter {
      private state = { count: 0 };

      constructor() {
        listener(this, () => {});
        event(this);
      }

      read() {
        return touch(this, 'count', this.state.count);
      }

      bump() {
        this.state.count++;
        event(this, 'count');
      }
    }

    const counter = new Counter();
    const cb = mock();
    let proxy!: Counter;

    watch(counter, ($) => {
      proxy = $;
      cb($.read());
    });

    expect(cb).toBeCalledWith(0);
    expect(cb).toBeCalledTimes(1);

    proxy.bump();
    await new Promise((r) => setTimeout(r, 5));

    expect(cb).toBeCalledWith(1);
    expect(cb).toBeCalledTimes(2);
  });

  it('will silently no-op when event called on non-observable', () => {
    expect(() => event({}, 'foo')).not.toThrow();
  });

  describe('event', () => {
    it('will auto-create bundle and fire ready on no-key call', () => {
      const test = {};

      expect(observer(test)).toBeUndefined();

      event(test);

      const o = observer(test);
      expect(o).toBeDefined();
      expect(o!.ready).toBe(true);
    });

    it('will not re-fire ready on observable', () => {
      const test = {};
      const cb = mock();

      event(test);
      listener(test, cb);
      cb.mockClear();

      event(test);

      expect(cb).not.toBeCalled();
    });

    it('will not auto-init for keyed event', () => {
      const test = {};

      event(test, 'foo');

      expect(observer(test)).toBeUndefined();
    });

    it('will fire watch effect immediately on ready', () => {
      const test = {};
      const cb = mock();

      event(test);
      watch(test, () => cb());

      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe('observer', () => {
    it("will return undefined for object which isn't observed", () => {
      expect(observer({})).toBeUndefined();
    });

    it('will return bundle without ready for observable not ready', () => {
      const test = {};

      listener(test, () => {});

      expect("ready" in observer(test, true)).toBe(false);
    });

    it('will return with ready=true for ready observable', () => {
      const test = {};
      const didInit = mock();

      listener(test, didInit);
      event(test);

      expect(didInit).toBeCalledWith(true);
      expect(observer(test, true).ready).toBe(true);
    });

    it('will return null for terminated observable', () => {
      const test = {};
      const onEvent = mock();

      listener(test, onEvent);
      event(test, null);

      expect(observer(test)).toBe(null);
      expect(onEvent).toBeCalledWith(null);
    });

    it('will throw when registering a listener on a terminated state', () => {
      const test = {};

      listener(test, () => {});
      event(test, null);

      expect(() => listener(test, () => {})).toThrow(/terminated/);
    });
  });
});
