import { mockPromise, mockWarn } from '../mocks';
import { Model } from '../model';
import { set } from './set';

const warn = mockWarn();

it('will be enumerable', () => {
  class Test extends Model {
    value = set('foo');
  }

  const test = Test.new();

  expect(Object.keys(test)).toContain('value');
});

describe('placeholder', () => {
  class Test extends Model {
    foobar = set<string>();
  }

  it('will suspend if value is accessed before assign', async () => {
    const instance = Test.new();
    const promise = mockPromise<string>();
    const mockEffect = jest.fn((state: Test) => {
      promise.resolve(state.foobar);
    });

    instance.get(mockEffect);

    expect(mockEffect).toBeCalledTimes(1);

    instance.foobar = 'foo!';

    const result = await promise;

    expect(mockEffect).toBeCalledTimes(2);
    expect(result).toBe('foo!');
  });

  it('will resolve suspense after latest value', async () => {
    const test = Test.new();
    const foobar = jest.fn();
    const effect = jest.fn((state: Test) => {
      foobar(state.foobar);
    });

    test.get(effect);

    expect(effect).toBeCalledTimes(1);
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

    const mockEffect = jest.fn((state: Test) => {
      expect(state.foobar).toBe('bar!');
    });

    instance.get(mockEffect);
    expect(mockEffect).toBeCalledTimes(1);
  });
});

describe('callback', () => {
  it('will invoke callback on property assign', async () => {
    class Subject extends Model {
      test = set<number>(1, (value) => {
        didAssign(value + 1);
      });
    }

    const state = Subject.new();
    const didAssign = jest.fn();
    const didUpdate = jest.fn();

    expect(didAssign).not.toBeCalled();

    state.set(didUpdate, 'test');
    state.test = 2;

    expect(didUpdate).toBeCalledTimes(1);
    expect(didAssign).toBeCalledWith(3);
  });

  // TODO: this is not implemented yet
  it.skip('will invoke callback on set assignment', async () => {
    const didAssign = jest.fn();

    class Subject extends Model {
      test = set<number>(1, didAssign);
    }

    const state = Subject.new();

    state.set({ test: 2 });

    expect(didAssign).toBeCalledWith(1);
  });

  it('will invoke return-callback on overwrite', async () => {
    class Subject extends Model {
      test = set<number>(1, () => {
        return () => {
          callback(true);
        };
      });
    }

    const callback = jest.fn();
    const state = Subject.new();

    state.test = 2;

    await expect(state).toHaveUpdated();
    expect(callback).not.toBeCalled();
    state.test = 3;

    await expect(state).toHaveUpdated();
    expect(callback).toBeCalledWith(true);
  });

  it('will assign a default value', async () => {
    class Subject extends Model {
      test = set('foo', (value) => {
        callback(value);
      });
    }

    const callback = jest.fn();
    const state = Subject.new();

    expect(state.test).toBe('foo');
    state.test = 'bar';

    await expect(state).toHaveUpdated();
    expect(callback).toBeCalledWith('bar');
  });

  it('will ignore effect promise', () => {
    class Subject extends Model {
      property = set<any>(undefined, async () => {});
    }

    const state = Subject.new();

    expect(() => (state.property = 'bar')).not.toThrow();
  });

  it('will not suspend own property access', () => {
    class Subject extends Model {
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
    class Subject extends Model {
      name = 'World';

      hello = set('Hello', async (value) => {
        this.get(({ name }) => {
          effect(`${value} ${name}!`);
        });
      });
    }

    const effect = jest.fn();
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
    class Subject extends Model {
      test = set('foo', (value) => {
        callback(value);
        return false;
      });
    }

    const callback = jest.fn();
    const state = Subject.new();

    expect(state.test).toBe('foo');
    state.test = 'bar';

    await expect(state).not.toHaveUpdated();
    expect(callback).toBeCalledWith('bar');
    expect(state.test).toBe('foo');
  });

  it('will not call prior cleanup if supressed', async () => {
    const cleanup = jest.fn();
    const setter = jest.fn((value) => {
      return value === 3 ? false : cleanup;
    });

    class Test extends Model {
      value = set(1, setter);
    }

    const subject = Test.new();

    subject.value = 2;

    expect(setter).toBeCalledWith(2, 1);
    await expect(subject).toHaveUpdated();
    expect(subject.value).toBe(2);

    // this update will be supressed by setter
    subject.value = 3;

    expect(setter).toBeCalledWith(3, 2);
    await expect(subject).not.toHaveUpdated();
    expect(cleanup).not.toBeCalled();

    subject.value = 4;

    expect(setter).toBeCalledWith(4, 2);
    expect(cleanup).toBeCalledTimes(1);
    expect(cleanup).toBeCalledWith(4);
  });
});

describe('factory', () => {
  it('will ignore setter if assigned', () => {
    const getValue = jest.fn(() => 'foo');

    class Test extends Model {
      value = set(getValue);
    }

    const test = Test.new();

    test.value = 'bar';

    expect(test).toHaveUpdated();
    expect(test.value).toBe('bar');
    expect(getValue).not.toBeCalled();
  });

  it('will compute when accessed', () => {
    const factory = jest.fn(() => 'Hello World');

    class Test extends Model {
      value = set(factory);
    }

    const test = Test.new();

    expect(factory).not.toBeCalled();

    void test.value;

    expect(factory).toBeCalled();
  });

  it('will compute lazily', () => {
    const factory = jest.fn(() => 'Hello World');

    class Test extends Model {
      value = set(factory, false);
    }

    const test = Test.new();

    expect(factory).not.toBeCalled();
    expect(test.value).toBe('Hello World');
    expect(factory).toBeCalledTimes(1);
  });

  it('will bind factory function to self', async () => {
    class Test extends Model {
      // methods lose implicit this
      value = set(this.method);

      async method() {
        expect(this).toBe(instance);
      }
    }

    const instance = Test.new();
  });

  it('will warn and rethrow error from factory', () => {
    class Test extends Model {
      memoized = set(this.failToGetSomething, true);

      failToGetSomething() {
        throw new Error('Foobar');
      }
    }

    const attempt = () => Test.new('ID');

    expect(attempt).toThrowError('Foobar');
    expect(warn).toBeCalledWith(
      `Generating initial value for ID.memoized failed.`
    );
  });
});

describe('suspense', () => {
  it.todo('will suspend for promise-like values');

  it('will throw suspense-promise resembling an error', () => {
    const promise = mockPromise();

    class Test extends Model {
      value = set(promise, true);
    }

    const instance = Test.new('ID');

    expect(() => instance.value).toThrowError(`ID.value is not yet available.`);
    promise.resolve();
  });

  it('will suspend on another pending set', async () => {
    const didEvaluate = jest.fn(function (this: Test) {
      return this.value + ' world!';
    });

    class Test extends Model {
      value = set<string>();
      greet = set(didEvaluate);
    }

    const test = Test.new();
    expect(() => test.greet).toThrow(expect.any(Promise));
    expect(didEvaluate).toBeCalledTimes(1);

    await test.set({ value: 'hello' });

    expect(didEvaluate).toBeCalledTimes(2);
    expect(test.greet).toBe('hello world!');
  });

  it('will suspend other set factories', async () => {
    const promise = mockPromise<string>();
    const didEvaluate = jest.fn(function (this: Test) {
      return this.value + ' world!';
    });

    class Test extends Model {
      value = set(promise);
      greet = set(didEvaluate);
    }

    const test = Test.new();
    expect(() => test.greet).toThrow(expect.any(Promise));
    expect(didEvaluate).toBeCalledTimes(1);

    promise.resolve('hello');
    await expect(test).toUpdate();

    expect(didEvaluate).toBeCalledTimes(2);
    expect(test.greet).toBe('hello world!');
  });

  it('will resolve when factory does', async () => {
    class Test extends Model {
      value = set(async () => 'foobar', true);
    }

    const test = Test.new();

    expect(() => test.value).toThrow(expect.any(Promise));

    await expect(test).toUpdate(0);

    expect(test.value).toBe('foobar');
  });

  it('will not suspend where already resolved', async () => {
    class Test extends Model {
      greet = set(async () => 'Hello', true);
      name = set(async () => 'World', true);

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

    class Test extends Model {
      value = set(promise, true);
    }

    const instance = Test.new();

    expect(() => instance.value).toThrow(expect.any(Promise));
    promise.resolve();
  });

  it('will be undefined if not required', async () => {
    const promise = mockPromise<string>();
    const mock = jest.fn();

    class Test extends Model {
      value = set(promise, false);
    }

    const test = Test.new();

    test.get(($) => mock($.value));
    expect(mock).toBeCalledWith(undefined);

    promise.resolve('foobar');
    await expect(test).toUpdate(0);

    expect(mock).toBeCalledWith('foobar');
  });

  it('will suspend another factory', async () => {
    const greet = mockPromise<string>();
    const name = mockPromise<string>();

    const didEvaluate = jest.fn(function (this: Test) {
      return this.greet + ' ' + this.name;
    });

    class Test extends Model {
      greet = set(greet, true);
      name = set(name, true);

      value = set(didEvaluate, true);
    }

    const test = Test.new();

    test.get(($) => void $.value);

    greet.resolve('Hello');
    await expect(test).toUpdate(0);

    name.resolve('World');
    await expect(test).toUpdate(0);

    expect(didEvaluate).toBeCalledTimes(3);
    expect(test.value).toBe('Hello World');
  });

  it('will suspend another factory (async)', async () => {
    const greet = mockPromise<string>();
    const name = mockPromise<string>();

    const didEvaluate = jest.fn(async function (this: Test) {
      return this.greet + ' ' + this.name;
    });

    class Test extends Model {
      greet = set(() => greet, true);
      name = set(() => name, true);
      value = set(didEvaluate, true);
    }

    const test = Test.new();

    test.get(($) => void $.value);

    greet.resolve('Hello');
    await expect(test).toUpdate(0);

    name.resolve('World');
    await expect(test).toUpdate(0);

    expect(didEvaluate).toBeCalledTimes(3);
    expect(test.value).toBe('Hello World');
  });

  it('will nest suspense', async () => {
    const promise = mockPromise<string>();
    const didUpdate = mockPromise<string>();

    class Child extends Model {
      value = set(promise, true);
    }

    class Test extends Model {
      child = new Child();

      childValue = set(() => {
        return this.child.value + ' world!';
      }, true);
    }

    const test = Test.new();
    const effect = jest.fn((state: Test) => {
      didUpdate.resolve(state.childValue);
    });

    test.get(effect);

    expect(effect).toBeCalledTimes(1);
    expect(effect).not.toHaveReturned();

    promise.resolve('hello');

    await expect(didUpdate).resolves.toBe('hello world!');
    expect(effect).toBeCalledTimes(2);
  });

  it('will return undefined on nested suspense', async () => {
    const promise = mockPromise<string>();

    class Test extends Model {
      asyncValue = set(() => promise, true);

      value = set(() => `Hello ${this.asyncValue}`, false);
    }

    const test = Test.new();

    expect(test.value).toBeUndefined();

    promise.resolve('World');
    await expect(test).toUpdate();

    expect(test.value).toBe('Hello World');
  });

  it('will squash repeating suspense', async () => {
    let pending = mockPromise();
    let suspend = true;

    const compute = jest.fn(() => {
      if (suspend) throw pending;

      return `OK I'm unblocked.`;
    });

    class Test extends Model {
      message = set(compute, true);
    }

    const test = Test.new();
    const didEvaluate = mockPromise<string>();

    const effect = jest.fn((state: Test) => {
      didEvaluate.resolve(state.message);
    });

    test.get(effect);

    expect(effect).toBeCalled();
    expect(effect).not.toHaveReturned();
    expect(compute).toBeCalledTimes(1);

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

    class Test extends Model {
      a = set(promise, true);
      b = set(promise2, true);

      sum = set(this.getSum);

      getSum() {
        const { a, b } = this;

        return `Answer is ${a + b}.`;
      }
    }

    const test = Test.new();

    const effect = jest.fn((state: Test) => void state.sum);

    test.get(effect);

    expect(effect).toBeCalled();

    promise.resolve(10);
    await expect(test).toUpdate();

    expect(effect).toBeCalledTimes(1);

    promise2.resolve(20);
    await expect(test).toUpdate();

    expect(test.sum).toBe('Answer is 30.');
    expect(effect).toBeCalledTimes(2);
  });

  it('will refresh and throw if async rejects', async () => {
    const promise = mockPromise();

    class Test extends Model {
      value = set(promise, true);
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

    expect(didThrow).toBe('oh no');
  });
});

describe('factory with callback overload', () => {
  it('calls callback after factory resolves', async () => {
    const callback = jest.fn();
    class Test extends Model {
      value = set(() => 'computed', callback);
    }
    const test = Test.new();
    expect(test.value).toBe('computed');
    expect(callback).toBeCalledWith('computed', undefined);
  });

  it('calls callback after async factory resolves', async () => {
    const callback = jest.fn();
    class Test extends Model {
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
    const callback = jest.fn();
    class Test extends Model {
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

it('supports custom PromiseLike objects as factory return', async () => {
  type Thenable<T> = {
    then: (onFulfilled?: (value: T) => any) => any;
  };

  const resolve: Thenable<string> = {
    then: (onFulfilled) => {
      setTimeout(() => {
        if (onFulfilled) onFulfilled('foobar');
      }, 0);

      return resolve;
    }
  };

  class Test extends Model {
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
