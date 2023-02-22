import { mockAsync, mockSuspense, renderHook } from '../helper/testing';
import { get } from '../instruction/get';
import { set } from '../instruction/set';
import { Model } from '../model';
import { Oops as Suspense } from '../suspense';
import { useTap } from './useTap';

const opts = { timeout: 100 };

describe("subvalue", () => {
  it('will access subvalue directly', async () => {
    class Test extends Model {
      value = "foo";
    }
  
    const parent = Test.new();
  
    const { result, waitForNextUpdate } =
      renderHook(() => useTap(parent, "value"))
  
    expect(result.current).toBe("foo");
  
    parent.value = "bar";
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  });
  
  it('will suspend if subvalue is undefined', async () => {
    class Test extends Model {
      value?: string = undefined;
    }
  
    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.new();
  
    test.renderHook(() => {
      useTap(instance, "value", true);
      promise.resolve();
    })
  
    test.assertDidSuspend(true);
  
    instance.value = "foobar!";
    await promise.pending();
  
    test.assertDidRender(true);
  })
});

describe("callback", () => {
  class Test extends Model {
    foo = 1;
    bar = 2;
    baz = 3;
  }

  it("will subscribe callback to updates", async () => {
    const test = Test.new();
    const didEvaluate = jest.fn();

    const { result, waitForNextUpdate } = renderHook(() => {
      return useTap(test, $ => {
        didEvaluate($.foo + $.bar);
        return Math.floor($.foo + $.bar);
      });
    });

    expect(result.current).toBe(3);

    test.foo = 2;
    await waitForNextUpdate(opts);

    expect(result.current).toBe(4);
    expect(didEvaluate).toHaveBeenCalledWith(4);
  })

  it("will not refresh if output does not change", async () => {
    const test = Test.new();
    const didEvaluate = jest.fn();

    const { result, rerender } = renderHook(() => {
      return useTap(test, $ => {
        didEvaluate($.foo + $.bar);
        return Math.floor($.foo + $.bar);
      });
    });

    expect(result.current).toBe(3);

    test.foo = 1.5;

    await test.on(true);

    rerender();

    expect(result.current).toBe(3);
    expect(didEvaluate).toHaveBeenCalledWith(3.5);
  })

  it("will disable updates if null returned", async () => {
    const instance = Test.new();
    const didRender = jest.fn(() => {
      return useTap(instance, $ => null);
    })

    const { result } = renderHook(didRender);

    expect(didRender).toBeCalledTimes(1);
    expect(result.current).toBe(null);

    instance.foo = 2;

    await instance.on(true);
    expect(didRender).toBeCalledTimes(1);
  })

  it("will use returned function as compute", async () => {
    const test = Test.new();
    const willCompute = jest.fn();
    const willMount = jest.fn();

    const { result, waitForNextUpdate } = renderHook(() => {
      return useTap(test, $ => {
        willMount();
        void $.foo;
  
        return () => {
          willCompute();
          return $.foo + $.bar;
        };
      });
    });

    expect(result.current).toBe(3);

    expect(willMount).toBeCalledTimes(1);
    expect(willCompute).toBeCalledTimes(1);

    test.foo = 2;

    await waitForNextUpdate(opts);

    expect(willMount).toBeCalledTimes(1);
    expect(willCompute).toBeCalledTimes(2);

    expect(result.current).toBe(4);
  })
});

describe("computed values", () => {
  class Test extends Model {
    random = 0;
    source?: string = undefined;

    value = get(this, x => {
      void x.random;
      return x.source;
    }, true);
  }

  it("will suspend if value is undefined", async () => {
    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.new();

    test.renderHook(() => {
      useTap(instance).value;
      promise.resolve();
    })

    test.assertDidSuspend(true);

    instance.source = "foobar!";
    await promise.pending();

    test.assertDidRender(true);
  })

  it("will suspend in method mode", async () => {
    class Test extends Model {
      source?: string = undefined;
      value = get(() => this.getValue, true);

      getValue(){
        return this.source;
      }
    }

    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.new();

    test.renderHook(() => {
      useTap(instance, "value");
      promise.resolve();
    })

    test.assertDidSuspend(true);
    instance.source = "foobar!";

    await promise.pending();
    test.assertDidRender(true);
  })

  it("will seem to throw error outside react", () => {
    const instance = Test.new();
    const expected = Suspense.NotReady(instance, "value");
    let didThrow: Error | undefined;

    try {
      void instance.value;
    }
    catch(err: any){
      didThrow = err;
    }

    expect(String(didThrow)).toBe(String(expected));
  })

  it("will return immediately if value is defined", async () => {
    const test = mockSuspense();
    const instance = Test.new();

    instance.source = "foobar!";

    let value: string | undefined;

    test.renderHook(() => {
      value = useTap(instance, "value");
    })

    test.assertDidRender(true);

    expect(value).toBe("foobar!");
  })

  it("will not resolve if value stays undefined", async () => {
    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.new();

    test.renderHook(() => {
      useTap(instance, "value");
      promise.resolve();
    })

    test.assertDidSuspend(true);

    instance.random = 1;

    // update to value is expected
    const pending = await instance.on(true);
    expect(pending).toContain("random");

    // value will still be undefined
    expect(instance.get().value).toBe(undefined);

    // give react a moment to render (if it were)
    await new Promise(res => setTimeout(res, 100));

    // expect no action - value still is undefined
    test.assertDidRender(false);

    instance.source = "foobar!";

    // we do expect a render this time
    await promise.pending();

    test.assertDidRender(true);
  })

  it('will refresh and throw if async rejects', async () => {
    const promise = mockAsync();
  
    class Test extends Model {
      value = get(async () => {
        await promise.pending();
        throw "oh no";
      })
    }
  
    const test = mockSuspense();
    const instance = Test.new();
    const didThrow = mockAsync();
  
    test.renderHook(() => {
      try {
        void useTap(instance).value;
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

  it.todo("will start suspense if value becomes undefined");
})

describe("get instruction", () => {
  it('will suspend if function is async', async () => {
    class Test extends Model {
      value = get(() => promise.pending());
    }
  
    const test = mockSuspense();
    const promise = mockAsync();
    const didRender = mockAsync();
    const instance = Test.new();
  
    test.renderHook(() => {
      void useTap(instance).value;
      didRender.resolve();
    })
  
    test.assertDidSuspend(true);
  
    promise.resolve();
    await didRender.pending();
  
    test.assertDidRender(true);
  })

  it('will suspend if value is promise', async () => {
    const promise = mockAsync<string>();
  
    class Test extends Model {
      value = get(promise.pending());
    }
  
    const test = mockSuspense();
    const didRender = mockAsync();
    const instance = Test.new();
  
    test.renderHook(() => {
      void useTap(instance).value;
      didRender.resolve();
    })
  
    test.assertDidSuspend(true);
  
    promise.resolve("hello");
    await didRender.pending();
  
    test.assertDidRender(true);
  })
});

describe("set instruction", () => {
  it('will suspend if value is accessed before put', async () => {
    class Test extends Model {
      foobar = set<string>();
    }

    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.new();

    test.renderHook(() => {
      useTap(instance, "foobar");
      promise.resolve();
    })

    test.assertDidSuspend(true);

    instance.foobar = "foo!";

    // expect refresh caused by update
    await promise.pending();

    test.assertDidRender(true);
  })

  it('will not suspend if value is defined', async () => {
    class Test extends Model {
      foobar = set<string>();
    }

    const test = mockSuspense();
    const instance = Test.new();

    instance.foobar = "foo!";

    test.renderHook(() => {
      useTap(instance, "foobar");
    })

    test.assertDidRender(true);
  })
})