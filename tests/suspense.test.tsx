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
  let didSuspend = false;
  let didRender = false;
  let didThrow: Error | undefined;

  const Waiting = () => {
    didSuspend = true;

    return <div>Waiting...</div>;
  }

  const Component = () => {
    try {
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

    didRender = true;

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
    },
    assertDidSuspend(yes: boolean){
      expect(didSuspend).toBe(yes);
    },
    assertDidThrow(error: Error){
      expect(didThrow).toBe(error);
    }
  }
}

describe("suspense", () => {
  it('will auto-suspend if willRender is instruction', async () => {
    const { trigger, pending } = manageAsync();

    class Test extends Model {
      willRender = suspend(() => pending);
    }

    const test = scenario();
    const instance = Test.create();

    test.assertDidSuspend(false);

    test.renderHook(() => {
      instance.tap();
    })
  
    test.assertDidSuspend(true);
    test.assertDidRender(false);

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

    test.assertDidSuspend(false);

    test.renderHook(() => {
      instance.tap();
    })
  
    test.assertDidSuspend(true);
    test.assertDidRender(false);

    trigger();
    await instance.update();

    test.assertDidThrow(error);
  })
})