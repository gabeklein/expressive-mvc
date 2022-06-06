import { Model, put } from '..';
import { ensure, mockAsync, mockSuspense, mockTimeout } from '../../tests/adapter';
import { Oops as Util } from '../util';
import { Oops as Assign } from './put';

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

describe("callback", () => {
  it('will invoke callback on property update', async () => {
    class Subject extends Model {
      test = put<number>(0, value => {
        callback(value + 1);
      });
    }

    const state = Subject.create();
    const callback = jest.fn()
    const event = jest.fn();

    expect(callback).not.toBeCalled();
    state.once("test", event);

    state.test = 1;
    expect(callback).toBeCalledWith(2);

    await state.update(true)
    expect(event).toBeCalledWith(1, "test");
  })

  it('will invoke return-callback on overwrite', async () => {
    class Subject extends Model {
      test = put<number>(0, () => {
        return () => {
          callback(true);
        }
      });
    }

    const callback = jest.fn()
    const state = Subject.create();

    state.test = 1;

    await state.update(true);
    expect(callback).not.toBeCalled();
    state.test = 2;

    await state.update(true);
    expect(callback).toBeCalledWith(true);
  })

  it('will assign a default value', async () => {
    class Subject extends Model {
      test = put(() => "foo", value => {
        callback(value);
      });
    }

    const callback = jest.fn()
    const state = Subject.create();

    expect(state.test).toBe("foo");
    state.test = "bar";

    await state.update();
    expect(callback).toBeCalledWith("bar");
  })

  it('will ignore effect promise', () => {
    class Subject extends Model {
      property = put<any>(0, async () => {});
    }

    const state = Subject.create();

    expect(() => state.property = "bar").not.toThrow();
  })

  it('will throw on bad effect return', () => {
    class Subject extends Model {
      // @ts-ignore
      property = put<any>(0, () => 3);
    }

    const expected = Util.BadCallback();
    const state = Subject.create();

    expect(() => state.property = "bar").toThrow(expected);
  })
})

describe("intercept", () => {
  it('will prevent update if callback returns false', async () => {
    class Subject extends Model {
      test = put(() => "foo", value => {
        callback(value);
        return false;
      });
    }

    const callback = jest.fn()
    const state = Subject.create();

    expect(state.test).toBe("foo");
    state.test = "bar";

    await state.update(false);
    expect(callback).toBeCalledWith("bar");
    expect(state.test).toBe("foo");
  })

  it('will block value if callback returns true', async () => {
    class Subject extends Model {
      test = put(() => "foo", value => true);
    }

    const state = Subject.create();

    expect(state.test).toBe("foo");
    state.test = "bar";

    await state.update(true);
    expect(state.test).toBe("foo");
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
      value = put(promise.await);
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
    await didRender.await();

    test.assertDidRender(true);
  })

  it('will suspend for a supplied promise', async () => {
    const promise = mockAsync<string>();

    class Test extends Model {
      value = put(promise.await());
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
    await didRender.await();

    test.assertDidRender(true);
  })

  it("will seem to throw error outside react", () => {
    const promise = mockAsync();

    class Test extends Model {
      value = put(promise.await);
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
        await promise.await();
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

    const error = await didThrow.await();

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
    greet = put(greet.await);
    name = put(name.await);
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