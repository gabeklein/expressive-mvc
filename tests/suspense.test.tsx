import React, { Suspense } from 'react';

import { Model, render, suspend } from './adapter';

function manageAsync<T = void>(){
  let trigger!: (value: T) => void;

  const pending = new Promise<T>(resolve => {
    trigger = resolve;
  })

  return { pending, trigger }
}

function scenario(){
  let tryFunction!: () => void;
  let didRender = false;
  let didSuspend = false;
  let didThrow: Error | undefined;

  const Waiting = () => {
    didSuspend = true;

    return <div>Waiting...</div>;
  }

  const Component = () => {
    try {
      didRender = true;
      tryFunction();
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
      tryFunction = fn;
  
      render(
        <Suspense fallback={<Waiting/>}>
          <Component />
        </Suspense>
      )
    },
    assertDidRender(yes: boolean){
      expect(didRender).toBe(yes);
      expect(didSuspend).toBe(false);
      didSuspend = didRender = false;
    },
    assertDidSuspend(yes: boolean){
      expect(didSuspend).toBe(yes);
      didSuspend = didRender = false;
    },
    assertDidThrow(error: Error | false){
      if(error)
        expect(didThrow).toBe(error);
      else
        expect(didThrow).toBeUndefined();
    }
  }
}

describe("async function", () => {
  it('will auto-suspend if willRender is instruction', async () => {
    const { trigger, pending } = manageAsync();

    class Test extends Model {
      willRender = suspend(() => pending);
    }

    const test = scenario();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap();
    })
  
    test.assertDidSuspend(true);

    trigger();
    await instance.update();

    test.assertDidRender(true);
  })
  
  it('will refresh and throw if async rejects', async () => {
    const { trigger, pending } = manageAsync();
    const error = new Error("some foobar went down");

    class Test extends Model {
      willRender = suspend(async () => {
        await pending;
        throw error;
      })
    }

    const test = scenario();
    const instance = Test.create();

    test.renderHook(() => {
      instance.tap();
    })
  
    test.assertDidSuspend(true);

    trigger();
    await instance.update();

    test.assertDidThrow(error);
  })
  
  it('will bind async function to self', async () => {
    class Test extends Model {
      // methods lose implicit this
      willRender = suspend(this.method);

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