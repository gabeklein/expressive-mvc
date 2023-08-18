import { mockError, mockPromise, mockWarn } from '../tests/mocks';
import { Model } from '../model';
import { get } from './get';
import { set } from './set';
import { use } from './use';

const error = mockError();
const warn = mockWarn();

describe("placeholder", () => {
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

    instance.foobar = "foo!";

    const result = await promise;

    expect(mockEffect).toBeCalledTimes(2);
    expect(result).toBe("foo!");
  })
  
  it('will not suspend if value is defined', async () => {
    const instance = Test.new();

    instance.foobar = "bar!";

    const mockEffect = jest.fn((state: Test) => {
      expect(state.foobar).toBe("bar!");
    });

    instance.get(mockEffect);
    expect(mockEffect).toBeCalledTimes(1);
  })
})

describe("callback", () => {
  it('will invoke callback on property put', async () => {
    class Subject extends Model {
      test = set<number>(1, value => {
        didAssign(value + 1);
      });
    }

    const state = Subject.new();
    const didAssign = jest.fn()
    const didUpdate = jest.fn();

    expect(didAssign).not.toBeCalled();

    state.set((key) => {
      if(key == "test")
        didUpdate();
    });

    state.test = 2;

    expect(didUpdate).toBeCalledTimes(1);
    expect(didAssign).toBeCalledWith(3);
  })

  it('will invoke return-callback on overwrite', async () => {
    class Subject extends Model {
      test = set<number>(1, () => {
        return () => {
          callback(true);
        }
      });
    }

    const callback = jest.fn()
    const state = Subject.new();

    state.test = 2;

    await expect(state).toUpdate();
    expect(callback).not.toBeCalled();
    state.test = 3;

    await expect(state).toUpdate();
    expect(callback).toBeCalledWith(true);
  })

  it('will assign a default value', async () => {
    class Subject extends Model {
      test = set("foo", value => {
        callback(value);
      });
    }

    const callback = jest.fn()
    const state = Subject.new();

    expect(state.test).toBe("foo");
    state.test = "bar";

    await expect(state).toUpdate();
    expect(callback).toBeCalledWith("bar");
  })

  it('will ignore effect promise', () => {
    class Subject extends Model {
      property = set<any>(undefined, async () => {});
    }

    const state = Subject.new();

    expect(() => state.property = "bar").not.toThrow();
  })

  it('will not suspend own property access', () => {
    class Subject extends Model {
      property = set<string>(undefined, (_, previous) => {
        propertyWas = previous;
      });
    }

    const state = Subject.new();
    let propertyWas: string | undefined;

    state.property = "bar";
    expect(propertyWas).toBe(undefined);

    state.property = "foo";
    expect(propertyWas).toBe("bar");
  })
})

describe("intercept", () => {
  it('will prevent update if callback returns false', async () => {
    class Subject extends Model {
      test = set("foo", value => {
        callback(value);
        return false;
      });
    }

    const callback = jest.fn()
    const state = Subject.new();

    expect(state.test).toBe("foo");
    state.test = "bar";

    await expect(state).not.toUpdate();
    expect(callback).toBeCalledWith("bar");
    expect(state.test).toBe("foo");
  })

  it('will not call prior cleanup if supressed', async () => {
    const cleanup = jest.fn();
    const setter = jest.fn(value => {
      return value === 3 ? false : cleanup;
    });
    
    class Test extends Model {
      value = set(1, setter);
    }

    const subject = Test.new();

    subject.value = 2;

    expect(setter).toBeCalledWith(2, 1);
    await expect(subject).toUpdate();
    expect(subject.value).toBe(2);

    // this update will be supressed by setter
    subject.value = 3;

    expect(setter).toBeCalledWith(3, 2);
    await expect(subject).not.toUpdate();
    expect(cleanup).not.toBeCalled();

    subject.value = 4;

    expect(setter).toBeCalledWith(4, 2);
    expect(cleanup).toBeCalledTimes(1);
    expect(cleanup).toBeCalledWith(4);
  })
})

describe("factory", () => {
  it("will ignore setter if assigned", () => {
    const getValue = jest.fn(() => "foo");
    
    class Test extends Model {
      value = set(getValue);
    }

    const test = Test.new();

    test.value = "bar";

    expect(test).toUpdate();
    expect(test.value).toBe("bar");
    expect(getValue).not.toBeCalled();
  })

  it("will compute when accessed", () => {
    const factory = jest.fn(() => "Hello World");

    class Test extends Model {
      value = set(factory);
    }

    const test = Test.new();

    expect(factory).not.toBeCalled();

    void test.value;

    expect(factory).toBeCalled();
  })

  it("will compute lazily", () => {
    const factory = jest.fn(async () => "Hello World");

    class Test extends Model {
      value = set(factory, false);
    }

    Test.new();

    expect(factory).not.toBeCalled();
  })

  it('will bind factory function to self', async () => {
    class Test extends Model {
      // methods lose implicit this
      value = set(this.method);

      async method(){
        expect(this).toBe(instance);
      }
    }

    const instance = Test.new();
  })

  it("will emit when factory resolves", async () => {
    class Test extends Model {
      value = set(async () => "foobar");
    }

    const test = Test.new();

    expect(() => test.value).toThrow(expect.any(Promise));

    await test.set(0);

    expect(test.value).toBe("foobar");
  })

  it("will not suspend where already resolved", async () => {
    class Test extends Model {
      greet = set(async () => "Hello");
      name = set(async () => "World");

      value = set(() => this.greet + " " + this.name);
    }

    const test = Test.new();

    try {
      void test.value;
    }
    catch(error){
      if(error instanceof Promise)
        await expect(error).resolves.toBe("Hello World");
      else
        throw error;
    }

    expect(() => test.value).not.toThrow();
  })

  it("will throw suspense-promise resembling an error", () => {
    const promise = mockPromise();

    class Test extends Model {
      value = set(promise);
    }

    const instance = Test.new("ID");

    expect(() => instance.value).toThrowError(`Test-ID.value is not yet available.`);
    promise.resolve();
  })

  it("will suspend required-compute while still pending", () => {
    const promise = mockPromise();

    class Test extends Model {
      value = set(promise, true);
    }

    const instance = Test.new();

    expect(() => instance.value).toThrow(expect.any(Promise));
    promise.resolve();
  })

  it("will return undefined if not required", async () => {
    const promise = mockPromise<string>();
    const mock = jest.fn();

    class Test extends Model {
      value = set(promise, false);
    }

    const test = Test.new();

    test.get($ => mock($.value));
    expect(mock).toBeCalledWith(undefined);

    promise.resolve("foobar");
    await test.set(0);

    expect(mock).toBeCalledWith("foobar");
  })

  it("will warn and rethrow error from factory", () => {
    class Test extends Model {
      memoized = set(this.failToGetSomething, true);

      failToGetSomething(){
        throw new Error("Foobar") 
      }
    }

    const attempt = () => Test.new("ID");

    expect(attempt).toThrowError("Foobar");
    expect(warn).toBeCalledWith(`Generating initial value for Test-ID.memoized failed.`);
  })

  it("will suspend another factory", async () => {
    const greet = mockPromise<string>();
    const name = mockPromise<string>();

    const didEvaluate = jest.fn(
      (_key: string, $: Test) => {
        return $.greet + " " + $.name;
      }
    );

    class Test extends Model {
      greet = set(greet);
      name = set(name);

      value = set(didEvaluate);
    }

    const test = Test.new();

    test.get($ => void $.value);

    greet.resolve("Hello");
    await test.set(0);

    name.resolve("World");
    await test.set(0);

    expect(didEvaluate).toBeCalledTimes(3);
    expect(didEvaluate).toHaveReturnedWith("Hello World");
  })

  it("will suspend another factory (async)", async () => {
    const greet = mockPromise<string>();
    const name = mockPromise<string>();

    const didEvaluate = jest.fn(
      async (_key: string, $: Test) => {
        return $.greet + " " + $.name;
      }
    );

    class Test extends Model {
      greet = set(() => greet);
      name = set(() => name);
      value = set(didEvaluate);
    }

    const test = Test.new();

    test.get($ => void $.value);

    greet.resolve("Hello");
    await test.set(0);

    name.resolve("World");
    await test.set(0);

    expect(didEvaluate).toBeCalledTimes(3);
    expect(test.value).toBe("Hello World");
  })

  it("will nest suspense", async () => {
    const promise = mockPromise<string>();
    const didUpdate = mockPromise<string>();

    class Child extends Model {
      value = set(promise);
    }

    class Test extends Model {
      child = use(Child);
      
      childValue = get(this, self => {
        return self.child.value + " world!";
      });
    }

    const test = Test.new();
    const effect = jest.fn((state: Test) => {
      didUpdate.resolve(state.childValue);
    })

    test.get(effect);

    expect(effect).toBeCalledTimes(1);
    expect(effect).not.toHaveReturned();

    promise.resolve("hello");

    await expect(didUpdate).resolves.toBe("hello world!");
    expect(effect).toBeCalledTimes(2);
  })

  it("will return undefined on suspense", async () => {
    const promise = mockPromise<string>();
    const didEvaluate = mockPromise<string>();

    class Test extends Model {
      asyncValue = set(() => promise);

      value = get(this, ({ asyncValue }) => {
        return `Hello ${asyncValue}`;
      });
    }

    const test = Test.new();
    const effect = jest.fn((state: Test) => {
      didEvaluate.resolve(state.value);
    });

    test.get(effect);

    expect(effect).toBeCalledTimes(1);
    expect(effect).not.toHaveReturned();

    promise.resolve("World");

    await didEvaluate;

    expect(test.value).toBe("Hello World")
  })

  it("will squash repeating suspense", async () => {
    let pending = mockPromise();
    let suspend = true;

    const compute = jest.fn(() => {
      if(suspend)
        throw pending;

      return `OK I'm unblocked.`;
    });

    class Test extends Model {
      message = set(compute);
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
  })

  it("will squash multiple dependancies", async () => {
    const promise = mockPromise<number>();
    const promise2 = mockPromise<number>();

    class Test extends Model {
      a = set(promise);
      b = set(promise2);

      sum = set(this.getSum);

      getSum(){
        const { a, b } = this;

        return `Answer is ${a + b}.`;
      }
    }

    const test = Test.new();
    const didEvaluate = mockPromise<string>();

    const effect = jest.fn((state: Test) => {
      didEvaluate.resolve(state.sum);
    });

    test.get(effect);

    expect(effect).toBeCalled();
    expect(effect).not.toHaveReturned();

    promise.resolve(10);
    promise2.resolve(20);

    await didEvaluate;

    expect(test.sum).toBe("Answer is 30.")
  })

  it('will refresh and throw if async rejects', async () => {
    const promise = mockPromise();

    class Test extends Model {
      value = set(async () => {
        await promise;
        throw "oh no";
      })
    }

    const instance = Test.new();
    let didThrow: Error | undefined;
    
    instance.get(state => {
      try {
        void state.value;
      }
      catch(err: any){
        throw didThrow = err;
      }
    });

    expect(didThrow).toBeInstanceOf(Promise);

    promise.resolve();
    await new Promise(res => setTimeout(res, 10))

    expect(didThrow).toBe("oh no");
    expect(error).toBeCalledWith("oh no");
  })
})