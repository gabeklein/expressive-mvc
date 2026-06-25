import { mock, describe, it, expect } from 'bun:test';
import { mockPromise, mockWarn } from '../../test.setup';
import { State } from '../state';
import { set } from './set';

const warn = mockWarn();

describe('property descriptors', () => {
  it('will not be enumerable with value', () => {
    class Test extends State {
      value = set('foo');
    }

    const test = Test.new();

    expect(Object.keys(test)).not.toContain('value');
  });

  it('will not be enumerable with factory', () => {
    class Test extends State {
      value = set(() => 'foo');
    }

    const test = Test.new();

    expect(Object.keys(test)).not.toContain('value');
  });

  it('will be writable with value', () => {
    class Test extends State {
      value = set('foo');
    }

    const test = Test.new();

    test.value = 'bar';
    expect(test.value).toBe('bar');
  });

  it('will be read-only with factory', () => {
    class Test extends State {
      value = set(() => 'foo');
    }

    const test = Test.new();

    expect(() => {
      test.value = 'bar';
    }).toThrow(/read-only/);
  });

  it('will be read-only with required factory', () => {
    class Test extends State {
      value = set(() => 'foo', true);
    }

    const test = Test.new();

    expect(() => {
      test.value = 'bar';
    }).toThrow(/read-only/);
  });

  it('will be writable with factory and callback', () => {
    const callback = mock();

    class Test extends State {
      value = set(() => 'foo', callback);
    }

    const test = Test.new();

    test.value = 'bar';
    expect(test.value).toBe('bar');
    expect(callback).toBeCalledWith('bar', 'foo');
  });

  it('will be writable with placeholder and callback', () => {
    const callback = mock();

    class Test extends State {
      value = set<string>(undefined, callback);
    }

    const test = Test.new();

    test.value = 'hello';
    expect(callback).toBeCalledWith('hello', undefined);
  });
});

describe('placeholder', () => {
  class Test extends State {
    foobar = set<string>();
  }

  it('will suspend if value is accessed before assign', async () => {
    const instance = Test.new();
    const promise = mockPromise<string>();
    const mockEffect = mock((state: Test) => {
      promise.resolve(state.foobar);
    });

    instance.get(mockEffect);

    expect(mockEffect).toBeCalled();

    instance.foobar = 'foo!';

    const result = await promise;

    expect(mockEffect).toBeCalledTimes(2);
    expect(result).toBe('foo!');
  });

  it('will resolve suspense after latest value', async () => {
    const test = Test.new();
    const foobar = mock();
    const effect = mock((state: Test) => {
      foobar(state.foobar);
    });

    test.get(effect);

    expect(effect).toBeCalled();
    expect(foobar).not.toBeCalled();

    test.foobar = 'foo';
    test.foobar = 'bar';

    await expect(test).toHaveUpdated('foobar');

    expect(effect).toBeCalledTimes(2);
    expect(foobar).not.toBeCalledWith('foo');
    expect(foobar).toBeCalledWith('bar');
  });

  it('will not suspend if value is defined', async () => {
    const instance = Test.new();

    instance.foobar = 'bar!';

    const mockEffect = mock((state: Test) => {
      expect(state.foobar).toBe('bar!');
    });

    instance.get(mockEffect);
    expect(mockEffect).toBeCalledTimes(1);
  });
});

describe('callback', () => {
  it('will invoke callback on property assign', async () => {
    class Subject extends State {
      test = set<number>(1, (value) => {
        didAssign(value + 1);
      });
    }

    const state = Subject.new();
    const didAssign = mock();
    const didUpdate = mock();

    expect(didAssign).not.toBeCalled();

    state.set('test', didUpdate);
    state.test = 2;

    expect(didUpdate).toBeCalledTimes(1);
    expect(didAssign).toBeCalledWith(3);
  });

  // TODO: this is not implemented yet
  it.skip('will invoke callback on set assignment', async () => {
    const didAssign = mock();

    class Subject extends State {
      test = set<number>(1, didAssign);
    }

    const state = Subject.new();

    state.set({ test: 2 });

    expect(didAssign).toBeCalledWith(1);
  });

  it('will invoke return-callback on overwrite', async () => {
    class Subject extends State {
      test = set<number>(1, () => {
        return () => {
          callback(true);
        };
      });
    }

    const callback = mock();
    const state = Subject.new();

    state.test = 2;

    await expect(state).toHaveUpdated();
    expect(callback).not.toBeCalled();
    state.test = 3;

    await expect(state).toHaveUpdated();
    expect(callback).toBeCalledWith(true);
  });

  it('will assign a default value', async () => {
    class Subject extends State {
      test = set('foo', (value) => {
        callback(value);
      });
    }

    const callback = mock();
    const state = Subject.new();

    expect(state.test).toBe('foo');
    state.test = 'bar';

    await expect(state).toHaveUpdated();
    expect(callback).toBeCalledWith('bar');
  });

  it('will ignore effect promise', () => {
    class Subject extends State {
      property = set<any>(undefined, async () => {});
    }

    const state = Subject.new();

    expect(() => (state.property = 'bar')).not.toThrow();
  });

  it('will not suspend own property access', () => {
    class Subject extends State {
      property = set<string>(undefined, (_, previous) => {
        propertyWas = previous;
      });
    }

    const state = Subject.new();
    let propertyWas: string | undefined;

    state.property = 'bar';
    expect(propertyWas).toBe(undefined);

    state.property = 'foo';
    expect(propertyWas).toBe('bar');
  });

  it('will reset nested effects', async () => {
    class Subject extends State {
      name = 'World';

      hello = set('Hello', async (value) => {
        this.get(({ name }) => {
          effect(`${value} ${name}!`);
        });
      });
    }

    const effect = mock();
    const state = Subject.new();

    state.hello = 'Hola';
    await expect(state).toHaveUpdated();

    expect(effect).toBeCalledWith('Hola World!');

    state.hello = 'Bonjour';
    await expect(state).toHaveUpdated();

    expect(effect).toBeCalledWith('Bonjour World!');

    state.name = 'Earth';
    await expect(state).toHaveUpdated();

    expect(effect).toBeCalledWith('Bonjour Earth!');
    expect(effect).not.toBeCalledWith('Hola Earth!');
  });
});

describe('intercept', () => {
  it('will prevent update if callback returns false', async () => {
    class Subject extends State {
      test = set('foo', (value) => {
        callback(value);
        throw false;
      });
    }

    const callback = mock();
    const state = Subject.new();

    expect(state.test).toBe('foo');
    state.test = 'bar';

    await expect(state).not.toHaveUpdated();
    expect(callback).toBeCalledWith('bar');
    expect(state.test).toBe('foo');
  });

  it('will rethrow real errors from callback', () => {
    class Subject extends State {
      test = set('foo', () => {
        throw new Error('bad value');
      });
    }

    const state = Subject.new();

    expect(() => {
      state.test = 'bar';
    }).toThrow('bad value');
    expect(state.test).toBe('foo');
  });
});

describe('factory', () => {
  it('will throw for a direct Promise initializer', () => {
    const pending = mockPromise<string>();

    class Test extends State {
      // @ts-expect-error
      value = set(pending);
    }

    expect(() => Test.new()).toThrow(
      /Direct promises are not supported in set\([\w-]+\.value\)\. Use set\(\(\) => promise\) instead\./
    );
  });

  it('will be read-only', () => {
    class Test extends State {
      value = set(() => 'foo');
    }

    const test = Test.new();

    expect(() => {
      test.value = 'bar';
    }).toThrow(/read-only/);
    expect(test.value).toBe('foo');
    expect(test.value).toBe('foo');
  });

  it('will compute when accessed', () => {
    const factory = mock(() => 'Hello World');

    class Test extends State {
      value = set(factory);
    }

    const test = Test.new();

    expect(factory).not.toBeCalled();

    void test.value;

    expect(factory).toBeCalled();
  });

  it('will compute lazily', () => {
    const factory = mock(() => 'Hello World');

    class Test extends State {
      value = set(factory, false);
    }

    const test = Test.new();

    expect(factory).not.toBeCalled();
    expect(test.value).toBe('Hello World');
    expect(factory).toBeCalledTimes(1);
  });

  it('will bind factory function to self', async () => {
    class Test extends State {
      // methods lose implicit this
      value = set(this.method);

      async method() {
        expect(this as Test).toBe(instance);
      }
    }

    const instance = Test.new();
  });

  it('will warn and rethrow error from factory', () => {
    class Test extends State {
      memoized = set(this.failToGetSomething);

      failToGetSomething() {
        throw new Error('Foobar');
      }
    }

    const test = Test.new();

    expect(() => test.memoized).toThrow('Foobar');
    expect(warn).toBeCalledWith(
      expect.stringMatching(
        /Generating initial value for [\w-]+\.memoized failed\./
      )
    );
  });
});

describe('compute', () => {
  it('will recompute when dependency updates', async () => {
    class Test extends State {
      first = 'John';
      last = 'Doe';
      full = set((self: Test) => `${self.first} ${self.last}`);
    }

    const test = Test.new();

    expect(test.full).toBe('John Doe');

    test.first = 'Jane';

    await expect(test).toHaveUpdated('first', 'full');
    expect(test.full).toBe('Jane Doe');
  });

  it('will receive instance as this and argument', () => {
    const seen = mock();

    class Test extends State {
      value = 1;
      double = set(function (this: Test, self: Test) {
        seen(this === self);
        return self.value * 2;
      });
    }

    const test = Test.new();

    expect(test.double).toBe(2);
    expect(seen).toBeCalledWith(true);
  });

  it('will be enumerable like a getter', () => {
    class Test extends State {
      value = 1;
      double = set((self: Test) => self.value * 2);
    }

    const test = Test.new();

    expect(Object.keys(test)).toContain('double');

    void test.double;

    expect(test.get()).toMatchObject({ value: 1, double: 2 });
  });

  it('will be read-only', () => {
    class Test extends State {
      value = 1;
      double = set((self: Test) => self.value * 2);
    }

    const test = Test.new();

    expect(() => {
      (test as any).double = 5;
    }).toThrow(/read-only/);
  });

  it('will not recompute for unrelated update', async () => {
    const factory = mock((self: Test) => self.value * 2);

    class Test extends State {
      value = 1;
      other = 'foo';
      double = set(factory);
    }

    const test = Test.new();

    void test.double;
    expect(factory).toBeCalled();

    test.other = 'bar';
    await expect(test).toHaveUpdated('other');

    void test.double;
    expect(factory).toBeCalledTimes(1);
  });

  it('will allow subclass to refine type via declare', () => {
    class Base extends State {
      source = 1;
      derived = set((self: Base) => self.source as unknown);
    }

    class Sub extends Base {
      declare derived: number;
    }

    const sub = Sub.new();

    expect(sub.derived).toBe(1);
  });
});

describe('suspense', () => {
  it('will throw suspense-promise resembling an error', () => {
    const promise = mockPromise();

    class Test extends State {
      value = set(() => promise);
    }

    const instance = Test.new();

    expect(() => instance.value).toThrow(
      /[\w-]+\.value is not yet available\./
    );
    expect(() => instance.value).toThrow(expect.any(Promise));
    promise.resolve();
  });

  it('will suspend on another pending set', async () => {
    const didEvaluate = mock(function (this: Test) {
      return this.value + ' world!';
    });

    class Test extends State {
      value = set<string>();
      greet = set(didEvaluate);
    }

    const test = Test.new();
    expect(() => test.greet).toThrow(expect.any(Promise));
    expect(didEvaluate).toBeCalled();

    await test.set({ value: 'hello' });

    expect(didEvaluate).toBeCalledTimes(2);
    expect(test.greet).toBe('hello world!');
  });

  it('will suspend other set factories', async () => {
    const promise = mockPromise<string>();
    const didEvaluate = mock(function (this: Test) {
      return this.value + ' world!';
    });

    class Test extends State {
      value = set(() => promise);
      greet = set(didEvaluate);
    }

    const test = Test.new();
    expect(() => test.greet).toThrow(expect.any(Promise));
    expect(didEvaluate).toBeCalled();

    promise.resolve('hello');
    await expect(test).toHaveUpdated();

    expect(didEvaluate).toBeCalledTimes(2);
    expect(test.greet).toBe('hello world!');
  });

  it('will resolve when factory does', async () => {
    class Test extends State {
      value = set(async () => 'foobar');
    }

    const test = Test.new();

    expect(() => test.value).toThrow(expect.any(Promise));

    await expect(test).toHaveUpdated();

    expect(test.value).toBe('foobar');
  });

  it('will not suspend where already resolved', async () => {
    class Test extends State {
      greet = set(async () => 'Hello');
      name = set(async () => 'World');

      value = set(() => this.greet + ' ' + this.name);
    }

    const test = Test.new();

    try {
      void test.value;
    } catch (error) {
      if (error instanceof Promise) await error;
      else throw error;
    }

    expect(() => test.value).not.toThrow();
  });

  it('will suspend if required while still pending', () => {
    const promise = mockPromise();

    class Test extends State {
      value = set(() => promise);
    }

    const instance = Test.new();

    expect(() => instance.value).toThrow(expect.any(Promise));
    promise.resolve();
  });

  it('will be undefined if not required', async () => {
    const promise = mockPromise<string>();
    const cb = mock();

    class Test extends State {
      value = set(() => promise, false);
    }

    const test = Test.new();

    test.get(($) => cb($.value));
    expect(cb).toBeCalledWith(undefined);

    promise.resolve('foobar');
    await expect(test).toHaveUpdated();

    expect(cb).toBeCalledWith('foobar');
  });

  it('will suspend another factory', async () => {
    const salute = mockPromise<string>();
    const name = mockPromise<string>();

    const didEvaluate = mock(function (this: Test) {
      return this.greet + ' ' + this.name;
    });

    class Test extends State {
      greet = set(() => salute);
      name = set(() => name);

      value = set(didEvaluate);
    }

    const test = Test.new();

    test.get(($) => void $.value);

    salute.resolve('Hello');
    await expect(test).toHaveUpdated();

    name.resolve('World');
    await expect(test).toHaveUpdated();

    expect(didEvaluate).toBeCalledTimes(3);
    expect(test.value).toBe('Hello World');
  });

  it('will suspend another factory (async)', async () => {
    const greet = mockPromise<string>();
    const name = mockPromise<string>();

    const didEvaluate = mock();

    class Test extends State {
      greet = set(async () => greet);
      name = set(() => name);
      value = set(() => {
        didEvaluate();
        return this.greet + ' ' + this.name;
      });
    }

    const test = Test.new();

    test.get(($) => void $.value);

    greet.resolve('Hello');
    await expect(test).toHaveUpdated();

    name.resolve('World');
    await expect(test).toHaveUpdated();

    expect(didEvaluate).toBeCalledTimes(3);
    expect(test.value).toBe('Hello World');
  });

  it('will nest suspense', async () => {
    const promise = mockPromise<string>();
    const didUpdate = mockPromise<string>();

    class Child extends State {
      value = set(() => promise);
    }

    class Test extends State {
      child = new Child();

      childValue = set(() => {
        return this.child.value + ' world!';
      });
    }

    const test = Test.new();
    const effect = mock((state: Test) => {
      didUpdate.resolve(state.childValue);
    });

    test.get(effect);

    expect(effect).toBeCalled();
    expect(effect).not.toHaveReturned();

    promise.resolve('hello');

    await expect(didUpdate).resolves.toBe('hello world!');
    expect(effect).toBeCalledTimes(2);
  });

  it('will return undefined on nested suspense', async () => {
    const promise = mockPromise<string>();

    class Test extends State {
      asyncValue = set(() => promise);

      value = set(() => `Hello ${this.asyncValue}`, false);
    }

    const test = Test.new();

    expect(test.value).toBeUndefined();

    promise.resolve('World');
    await expect(test).toHaveUpdated();

    expect(test.value).toBe('Hello World');
  });

  it('will squash repeating suspense', async () => {
    let pending = mockPromise();
    let suspend = true;

    const compute = mock(() => {
      if (suspend) throw pending;

      return `OK I'm unblocked.`;
    });

    class Test extends State {
      message = set(compute);
    }

    const test = Test.new();
    const didEvaluate = mockPromise<string>();

    const effect = mock((state: Test) => {
      didEvaluate.resolve(state.message);
    });

    test.get(effect);

    expect(effect).toBeCalled();
    expect(effect).not.toHaveReturned();
    expect(compute).toBeCalled();

    pending.resolve();
    pending = mockPromise();

    // TODO: why does this not work when `.set(0)` is used?
    await test.set();

    // expect eval to run again because promise resolved.
    expect(compute).toBeCalledTimes(2);

    suspend = false;
    pending.resolve();
    await didEvaluate;

    expect(test.message).toBe("OK I'm unblocked.");
    expect(compute).toBeCalledTimes(3);
    expect(effect).toBeCalledTimes(2);
    expect(effect).toHaveReturnedTimes(1);
  });

  it('will squash multiple dependancies', async () => {
    const promise = mockPromise<number>();
    const promise2 = mockPromise<number>();

    class Test extends State {
      a = set(() => promise);
      b = set(() => promise2);

      sum = set(this.getSum);

      getSum() {
        didAttemptSum();
        const { a, b } = this;

        return `Answer is ${a + b}.`;
      }
    }

    const test = Test.new();

    const didAttemptSum = mock();
    const didAttemptEffect = mock();
    const didCompleteEffect = mock();

    test.get((self) => {
      didAttemptEffect();
      didCompleteEffect(self.sum);
    });

    expect(didAttemptSum).toBeCalled();
    expect(didAttemptEffect).toBeCalled();

    promise.resolve(10);
    await expect(test).toHaveUpdated();

    expect(didAttemptSum).toBeCalledTimes(2);
    expect(didAttemptEffect).toBeCalled();
    expect(didCompleteEffect).not.toBeCalled();

    promise2.resolve(20);
    await expect(test).toHaveUpdated();

    expect(didAttemptSum).toBeCalledTimes(3);
    expect(test.sum).toBe('Answer is 30.');

    await new Promise<void>((r) => setTimeout(r, 0));
    expect(didAttemptEffect).toBeCalledTimes(2);
    expect(didCompleteEffect).toBeCalledWith('Answer is 30.');
  });

  it('will refresh and throw if async rejects', async () => {
    const promise = mockPromise();

    class Test extends State {
      value = set(() => promise);
    }

    const instance = Test.new();
    let didThrow: Promise<unknown> | undefined;

    instance.get((state) => {
      try {
        void state.value;
      } catch (err: any) {
        didThrow = err;

        if (err instanceof Promise) throw err;
      }
    });

    expect(didThrow).toBeInstanceOf(Promise);

    promise.reject('oh no');
    await new Promise((res) => setTimeout(res, 10));

    expect(await didThrow).toBe('oh no');
  });
});

describe('factory with callback overload', () => {
  it('calls callback after factory resolves', async () => {
    const callback = mock();
    const factory = mock(() => 'computed');
    class Test extends State {
      value = set(factory, callback);
    }
    const test = Test.new();
    expect(test.value).toBe('computed');
    test.value = 'manual';
    expect(callback).toBeCalledWith('computed', undefined);
    expect(factory).toBeCalledTimes(1);
  });

  it('calls callback after async factory resolves', async () => {
    const callback = mock();
    class Test extends State {
      value = set(async () => {
        await new Promise((res) => setTimeout(res, 10));
        return 'asyncValue';
      }, callback);
    }
    const test = Test.new();
    // Should throw a promise first (suspense)
    let threw: Promise<unknown> | undefined;
    try {
      void test.value;
    } catch (e) {
      threw = e as Promise<unknown>;
    }
    expect(threw).toBeInstanceOf(Promise);
    // Wait for promise to resolve
    await threw;
    expect(test.value).toBe('asyncValue');
    expect(callback).toBeCalledWith('asyncValue', undefined);
  });

  it('will callback if set before factory run', () => {
    const callback = mock();
    class Test extends State {
      value = set(async () => 'something', callback);
    }
    const test = Test.new();

    test.value = 'setBefore';
    expect(test.value).toBe('setBefore');
    expect(callback).toBeCalledWith('setBefore', undefined);

    test.value = 'setAfter';
    expect(test.value).toBe('setAfter');
    expect(callback).toBeCalledWith('setAfter', 'setBefore');
  });
});

it('supports Promise objects as factory return', async () => {
  const resolve = new Promise<string>((resolve) => {
    setTimeout(() => {
      resolve('foobar');
    }, 0);
  });

  class Test extends State {
    value = set(() => resolve);
  }

  const test = Test.new();
  let threw: Promise<string> | undefined;

  try {
    expect<string>(test.value);
  } catch (e) {
    threw = e as Promise<string>;
  }

  await expect(threw).resolves.toBe('foobar');
  expect(test.value).toBe('foobar');
});
