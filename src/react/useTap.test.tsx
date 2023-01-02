import React from 'react';

import { mockAsync, mockSuspense, render } from '../../tests/adapter';
import { get } from '../instruction/get';
import { set } from '../instruction/set';
import { Model } from '../model';
import { Oops as Suspense } from '../suspense';
import { Provider } from './provider';
import { useTap } from './useTap';

it("will get base-model from context", () => {
  class Test extends Model {}

  const Hook = () => {
    const value = useTap(Test);
    expect(value).toBeInstanceOf(Test);
    return null;
  }

  render(
    <Provider for={Test}>
      <Hook />
    </Provider>
  );
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
    const instance = Test.create();

    test.renderHook(() => {
      useTap(instance, "value");
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
    const instance = Test.create();

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
    const instance = Test.create();
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
    const instance = Test.create();

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
    const instance = Test.create();

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

    const test = Test.create();

    test.effect(state => mock(state.value));

    expect(mock).toBeCalledWith(undefined);

    promise.resolve("foobar");
    await test.update();

    expect(mock).toBeCalledWith("foobar");
  })

  it.todo("will start suspense if value becomes undefined");
})

describe("computed factory", () => {
  it('will suspend if value is async', async () => {
    class Test extends Model {
      value = get(promise.pending);
    }
  
    const test = mockSuspense();
    const promise = mockAsync();
    const didRender = mockAsync();
    const instance = Test.create();
  
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
    const instance = Test.create();
  
    test.renderHook(() => {
      void useTap(instance).value;
      didRender.resolve();
    })
  
    test.assertDidSuspend(true);
  
    promise.resolve("hello");
    await didRender.pending();
  
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
    const instance = Test.create();
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
});

describe("set instruction", () => {
  it('will suspend if value is accessed before put', async () => {
    class Test extends Model {
      foobar = set<string>();
    }

    const test = mockSuspense();
    const promise = mockAsync();
    const instance = Test.create();

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
    const instance = Test.create();

    instance.foobar = "foo!";

    test.renderHook(() => {
      useTap(instance, "foobar");
    })

    test.assertDidRender(true);
  })
})