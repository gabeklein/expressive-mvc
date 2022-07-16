import { Model } from '..';
import { ensure, mockAsync, mockSuspense, mockTimeout } from '../../tests/adapter';
import { Oops as Assign, put } from './put';

describe("required", () => {
  it("will compute pending value immediately", () => {
    const factory = jest.fn(async () => "Hello World");

    class Test extends Model {
      value = put(factory);
    }

    Test.create();

    expect(factory).toBeCalled();
  })

  it("will emit when async resolved", async () => {
    class Test extends Model {
      value = put(() => Promise.resolve("foobar"));
    }

    const test = Test.create();

    expect(() => test.value).toThrow(expect.any(Promise));

    await test.once("value");

    expect(test.value).toBe("foobar");
  })

  it("will throw if put to undefined", () => {
    class Test extends Model {
      value = put("foo");
    }

    const test = Test.create();
    const expected = Assign.NonOptional(test, "value");

    // @ts-ignore
    expect(() => test.value = undefined).toThrowError(expected);
    expect(() => test.value = "bar").not.toThrow();
  })
})

describe("optional", () => {
  it("will only compute when needed", () => {
    const factory = jest.fn(async () => "Hello World");

    class Test extends Model {
      value = put(factory, false);
    }

    Test.create();

    expect(factory).not.toBeCalled();
  })

  it("will not throw if value remains undefined", () => {
    class Test extends Model {
      value?: string = put(undefined, false);
    }

    const test = Test.create();

    expect(() => test.value = undefined).not.toThrowError();
    expect(() => test.value = "bar").not.toThrow();
  })

  it("will not throw if value set to undefined", () => {
    class Test extends Model {
      value = put("bar", false);
    }

    const test = Test.create();

    expect(() => test.value = undefined).not.toThrow();
    expect(() => test.value = "foo").not.toThrow();
  })
})

describe("memo", () => {
  const { error, warn } = console;

  afterAll(() => {
    console.warn = warn;
    console.error = error;
  });

  class Test extends Model {
    ranMemo = jest.fn();
    ranLazyMemo = jest.fn();

    memoized = put(() => {
      this.ranMemo();
      return "foobar";
    });

    memoLazy = put(() => {
      this.ranLazyMemo();
      return "foobar";
    }, false);
  }

  it("will run memoize on create", () => {
    const state = Test.create();

    expect(state.memoized).toBe("foobar");
    expect(state.ranMemo).toBeCalled();
  })

  it("will run only on access in lazy mode", () => {
    const state = Test.create();

    expect(state.ranLazyMemo).not.toBeCalled();

    expect(state.memoLazy).toBe("foobar");
    expect(state.ranLazyMemo).toBeCalled();
  })

  it("will warn and rethrow error from factory", () => {
    const warn = console.warn = jest.fn();

    class Test extends Model {
      memoized = put(() => {
        throw new Error("Foobar")
      })
    }

    const failed = Assign.Failed(Test.name, "memoized");

    expect(() => Test.create()).toThrowError("Foobar");
    expect(warn).toBeCalledWith(failed.message);
  })
})

describe("async", () => {
  it('will auto-suspend if assessed value is async', async () => {
    class Test extends Model {
      value = put(promise.pending);
    }

    const test = mockSuspense();
    const promise = mockAsync();
    const didRender = mockAsync();
    const instance = Test.create();

    test.renderHook(() => {
      void instance.tap().value;
      didRender.resolve();
    })

    test.assertDidSuspend(true);

    promise.resolve();
    await didRender.pending();

    test.assertDidRender(true);
  })

  it('will suspend for a supplied promise', async () => {
    const promise = mockAsync<string>();

    class Test extends Model {
      value = put(promise.pending());
    }

    const test = mockSuspense();
    const didRender = mockAsync();
    const instance = Test.create();

    test.renderHook(() => {
      void instance.tap().value;
      didRender.resolve();
    })

    test.assertDidSuspend(true);

    promise.resolve("hello");
    await didRender.pending();

    test.assertDidRender(true);
  })

  it("will seem to throw error outside react", () => {
    const promise = mockAsync();

    class Test extends Model {
      value = put(promise.pending);
    }

    const instance = Test.create();
    const exprected = Assign.NotReady(instance, "value");

    expect(() => instance.value).toThrowError(exprected);
    promise.resolve();
  })

  it('will refresh and throw if async rejects', async () => {
    const promise = mockAsync();

    class Test extends Model {
      value = put(async () => {
        await promise.pending();
        throw "oh no";
      })
    }

    const test = mockSuspense();
    const instance = Test.create();
    const didThrow = mockAsync();

    test.renderHook(() => {
      try {
        void instance.tap().value;
      }
      catch(err: any){
        if(err instanceof Promise)
          throw err;
        else
          didThrow.resolve(err);
      }
    })

    test.assertDidSuspend(true);

    promise.resolve();

    const error = await didThrow.pending();

    expect(error).toBe("oh no");
  })

  it('will bind async function to self', async () => {
    class Test extends Model {
      // methods lose implicit this
      value = put(this.method);

      async method(){
        expect(this).toBe(instance);
      }
    }

    const instance = Test.create();
  })
})

describe("nested suspense", () => {
  const greet = mockAsync<string>();
  const name = mockAsync<string>();

  class Mock extends Model {
    greet = put(greet.pending);
    name = put(name.pending);
  }

  it("will suspend a factory", async () => {
    const didEvaluate = jest.fn();

    class Test extends Mock {
      value = put(() => {
        didEvaluate();
        return this.greet + " " + this.name;
      });
    }

    const test = Test.create();
    const pending = ensure(() => test.value);

    greet.resolve("Hello");
    await mockTimeout();
    name.resolve("World");

    const value = await pending;

    expect(value).toBe("Hello World");
    expect(didEvaluate).toBeCalledTimes(3);
  })

  it("will suspend async factory", async () => {
    const didEvaluate = jest.fn();

    class Test extends Mock {
      value = put(async () => {
        didEvaluate();
        return this.greet + " " + this.name;
      });
    }

    const test = Test.create();
    const pending = ensure(() => test.value);

    greet.resolve("Hello");
    await mockTimeout();
    name.resolve("World");

    const value = await pending;

    expect(value).toBe("Hello World");
    expect(didEvaluate).toBeCalledTimes(3);
  })

  it("will not suspend if already resolved", async () => {
    class Test extends Model {
      greet = put(async () => "Hello");
      name = put(async () => "World");

      value = put(() => {
        return this.greet + " " + this.name;
      });
    }

    const test = Test.create();

    await test.once("value");

    expect(test.value).toBe("Hello World");
  })
})