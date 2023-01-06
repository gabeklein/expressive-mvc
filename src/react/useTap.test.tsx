import { mockAsync, mockSuspense, renderHook } from '../../tests/adapter';
import { get } from '../instruction/get';
import { set } from '../instruction/set';
import { use } from '../instruction/use';
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
  
  it('will subscribe to child controllers', async () => {
    class Parent extends Model {
      value = "foo";
      empty = undefined;
      child = use(Child);
    }
  
    class Child extends Model {
      value = "foo"
      grandchild = new GrandChild();
    }
  
    class GrandChild extends Model {
      value = "bar"
    }
  
    const parent = Parent.new();
    const { result, waitForNextUpdate } = renderHook(() => {
      return useTap(parent, "child").value;
    })
  
    expect(result.current).toBe("foo");
  
    parent.child.value = "bar"
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  
    parent.child = new Child();
    await waitForNextUpdate(opts);
    expect(result.current).toBe("foo");
  
    parent.child.value = "bar"
    await waitForNextUpdate(opts);
    expect(result.current).toBe("bar");
  })
})

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
    const pending = await instance.update(true);
    expect(pending).toContain("random");

    // value will still be undefined
    expect(instance.export().value).toBe(undefined);

    // give react a moment to render (if it were)
    await new Promise(res => setTimeout(res, 100));

    // expect no action - value still is undefined
    test.assertDidRender(false);

    instance.source = "foobar!";

    // we do expect a render this time
    await promise.pending();

    test.assertDidRender(true);
  })

  it("will return undefined if not required", async () => {
    const promise = mockAsync<string>();
    const mock = jest.fn();

    class Test extends Model {
      value = get(promise.pending, false);
    }

    const test = Test.new();

    test.on(state => mock(state.value));
    expect(mock).toBeCalledWith(undefined);

    promise.resolve("foobar");
    await test.update();

    expect(mock).toBeCalledWith("foobar");
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