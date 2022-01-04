import React, { Suspense } from 'react';

import { Oops } from '../src/suspense';
import { Model, render, pending } from './adapter';

function manageAsync<T = void>(){
  let trigger!: (value: T) => void;

  const pending = new Promise<T>(resolve => {
    trigger = resolve;
  })

  return [ pending, trigger ] as const;
}

function scenario(){
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

    return <div>Waiting...</div>;
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

    return <div>Content!</div>;
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
  it('will suspend any value if strict tap', async () => {
    class Test extends Model {
      value?: string = undefined;
    }

    const test = scenario();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("value", true);
    })
  
    test.assertDidSuspend(true);

    instance.value = "foo!";
    await instance.once("willRender");

    test.assertDidRender(true);
  })
})

describe("assigned", () => {
  it('will suspend if value is accessed before set', async () => {
    class Test extends Model {
      foobar = pending<string>();
    }

    const test = scenario();
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
      foobar = pending<string>();
    }

    const test = scenario();
    const instance = Test.create();

    instance.foobar = "foo!";

    test.renderHook(() => {
      instance.tap("foobar");
    })
  
    test.assertDidRender(true);
  })
})

describe("async function", () => {
  it('will auto-suspend if willRender is instruction', async () => {
    const [ promise, resolve ] = manageAsync();

    class Test extends Model {
      willRender = pending(() => promise);
    }

    const test = scenario();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap();
    })
  
    test.assertDidSuspend(true);

    resolve();
    await instance.update();

    test.assertDidRender(true);
  })

  it("will seem to throw \"error\" outside react", () => {
    const [ promise, resolve ] = manageAsync();

    class Test extends Model {
      value = pending(() => promise);
    }

    const instance = Test.create();
    const exprected = Oops.ValueNotReady(instance, "value");

    expect(() => instance.value).toThrowError(exprected);
    resolve();
  })
  
  it('will refresh and throw if async rejects', async () => {
    const [ promise, resolve ] = manageAsync();
    const error = new Error("some foobar went down");

    class Test extends Model {
      willRender = pending(async () => {
        await promise;
        throw error;
      })
    }

    const test = scenario();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap();
    })
  
    test.assertDidSuspend(true);

    resolve();
    await instance.update();

    test.assertDidThrow(error);
  })
  
  it('will bind async function to self', async () => {
    class Test extends Model {
      // methods lose implicit this
      willRender = pending(this.method);

      async method(){
        expect(this).toStrictEqual(instance);
      }
    }

    const test = scenario();
    const instance = Test.create();

    test.renderHook(() => instance.tap());

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
    const test = scenario();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap("value");
    })

    test.assertDidSuspend(true);

    instance.source = "foobar!";

    await instance.once("willRender");

    test.assertDidRender(true);
  })

  it("will seem to throw \"error\" outside react", () => {
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
    const test = scenario();
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
    const test = scenario();
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