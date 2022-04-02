import React, { Suspense } from 'react';

import { Oops } from '../src/suspense';
import { Model, pending, render, set, testAsync } from './adapter';

function testSuspense(){
  let renderHook!: () => void;
  let didRender = false;
  let didSuspend = false;
  let didThrow: Error | undefined;

  const reset = () => {
    didSuspend = didRender = false;
    didThrow = undefined;
  }

  const Waiting = () => {
    didSuspend = true;
    return null;
  }

  const Component = () => {
    try {
      didRender = true;
      renderHook();
    }
    catch(err: any){
      // let suspense do it's thing
      if(err instanceof Promise)
        throw err;

      // log and supress otherwise
      didThrow = err;
      return null;
    }

    return null;
  }

  return {
    renderHook(fn: () => void){
      renderHook = fn;
  
      render(
        <Suspense fallback={<Waiting/>}>
          <Component />
        </Suspense>
      )
    },
    assertDidRender(yes: boolean){
      expect(didRender).toBe(yes);
      expect(didSuspend).toBe(false);
      reset();
    },
    assertDidSuspend(yes: boolean){
      expect(didSuspend).toBe(yes);
      reset();
    },
    assertDidThrow(error: Error | false){
      if(error)
        expect(didThrow).toBe(error);
      else
        expect(didThrow).toBeUndefined();

      reset();
    }
  }
}

describe("tap method", () => {
  class Test extends Model {
    value?: string = undefined;
  }

  it('will suspend any value if strict tap', async () => {
    const test = testSuspense();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("value", true);
    })
  
    test.assertDidSuspend(true);

    instance.value = "foo!";
    await instance.once("willRender");

    test.assertDidRender(true);
  })

  it('will suspend if strict compute', async () => {
    const test = testSuspense();
    const promise = testAsync();
    const instance = Test.create();
    const rendered = jest.fn();
    const computed = jest.fn();

    test.renderHook(() => {
      promise.resolve();
      rendered();
    
      instance.tap(state => {
        computed();
        if(state.value == "foobar")
          return true;
      }, true);
    })
  
    test.assertDidSuspend(true);

    expect(computed).toBeCalledTimes(1);

    instance.value = "foobar";
    await promise.await();

    // 1st - render prior to bailing
    // 2nd - successful render
    expect(rendered).toBeCalledTimes(2);

    // 1st - initial render fails
    // 2nd - recheck success (permit render again)
    // 3rd - hook regenerated next render 
    expect(computed).toBeCalledTimes(3);
  })
})

describe("assigned", () => {
  it('will suspend if value is accessed before set', async () => {
    class Test extends Model {
      foobar = set<string>();
    }

    const test = testSuspense();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("foobar");
    })
  
    test.assertDidSuspend(true);

    instance.foobar = "foo!";

    // expect refresh caused by update
    await instance.once("willRender");

    test.assertDidRender(true);
  })

  it('will not suspend if value is defined', async () => {
    class Test extends Model {
      foobar = set<string>();
    }

    const test = testSuspense();
    const instance = Test.create();

    instance.foobar = "foo!";

    test.renderHook(() => {
      instance.tap("foobar");
    })
  
    test.assertDidRender(true);
  })
})

describe("async function", () => {
  it('will auto-suspend if assessed value is async', async () => {
    class Test extends Model {
      value = set(promise.await);
    }

    const promise = testAsync();
    const test = testSuspense();
    const instance = Test.create();

    test.renderHook(() => {
      void instance.tap().value;
    })
  
    test.assertDidSuspend(true);

    promise.resolve();
    await instance.update();

    test.assertDidRender(true);
  })

  it("will seem to throw error outside react", () => {
    const promise = testAsync();

    class Test extends Model {
      value = set(promise.await);
    }

    const instance = Test.create();
    const exprected = Oops.ValueNotReady(instance, "value");

    expect(() => instance.value).toThrowError(exprected);
    promise.resolve();
  })

  it('will refresh and throw if async rejects', async () => {
    const promise = testAsync();
    const expected = new Error("oh foo");

    class Test extends Model {
      value = set(async () => {
        await promise.await();
        throw expected;
      })
    }

    const test = testSuspense();
    const instance = Test.create();

    test.renderHook(() => {
      void instance.tap().value;
    })
  
    test.assertDidSuspend(true);

    promise.resolve();
    await instance.update();

    test.assertDidThrow(expected);
  })
  
  it('will bind async function to self', async () => {
    class Test extends Model {
      // methods lose implicit this
      value = set(this.method, false);

      async method(){
        expect(this).toStrictEqual(instance);
      }
    }

    const test = testSuspense();
    const instance = Test.create();

    test.renderHook(() => {
      void instance.tap().value;
    });

    await instance.update();

    test.assertDidThrow(false);
  })
})

describe("computed", () => {
  class Test extends Model {
    random = 0;
    source?: string = undefined;

    value = pending(this, x => {
      void x.random;
      return x.source;
    });
  }

  it("will suspend if value is undefined", async () => {
    const test = testSuspense();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("value");
    })

    test.assertDidSuspend(true);

    instance.source = "foobar!";

    await instance.once("willRender");

    test.assertDidRender(true);
  })

  it("will seem to throw error outside react", () => {
    const instance = Test.create();
    const expected = Oops.ValueNotReady(instance, "value");
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
    const test = testSuspense();
    const instance = Test.create();

    instance.source = "foobar!";

    let value: string | undefined;

    test.renderHook(() => {
      value = instance.tap("value");
    })

    test.assertDidRender(true);

    expect(value).toBe("foobar!");
  })

  it("will not resolve if value stays undefined", async () => {
    const test = testSuspense();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("value");
    })

    test.assertDidSuspend(true);

    instance.random = 1;

    // update to value is expected
    const pending = instance.update(true);
    await expect(pending).resolves.toContain("value");

    // value will still be undefined
    expect(instance.export().value).toBe(undefined);

    // give react a moment to render (if it were)
    await new Promise(res => setTimeout(res, 100));

    // expect no action - value still is undefined
    test.assertDidRender(false);
  
    instance.source = "foobar!";

    // we do expect a render this time
    await instance.once("willRender");

    test.assertDidRender(true);
  })

  it.todo("will start suspense if value becomes undefined");
})