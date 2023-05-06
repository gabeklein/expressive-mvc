import React from "react";

import { Model } from '@expressive/mvc';
import { renderHook, WrapperComponent } from '@testing-library/react-hooks';
import { Suspense } from 'react';
import { create } from 'react-test-renderer';
import { Provider } from '../provider';

export { renderHook } from '@testing-library/react-hooks';
export { create } from "react-test-renderer";

export function mockAsync<T = void>(){
  const pending = new Set<[Function, Function]>();

  const event = () => (
    new Promise<T>((res, rej) => {
      pending.add([res, rej]);
    })
  );

  const resolve = (value: T) => {
    const done = event();

    pending.forEach(x => x[0](value));
    pending.clear();

    return done;
  }

  return {
    pending: event,
    resolve
  }
}

export function mockSuspense(provide?: Model){
  const promise = mockAsync();

  let renderHook!: () => void;
  let didRender = false;
  let didSuspend = false;

  const reset = () => {
    didSuspend = didRender = false;
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
    finally {
      promise.resolve();
    }

    return null;
  }

  return {
    waitForNextRender(){
      return promise.pending();
    },
    renderHook(fn: () => void){
      renderHook = fn;

      let render = (
        <Suspense fallback={<Waiting />}>
          <Component />
        </Suspense>
      )

      if(provide)
        render = (
          <Provider for={provide}>
            {render}
          </Provider>
        )

      create(render);
    },
    assertDidRender(yes: boolean){
      expect(didRender).toBe(yes);
      expect(didSuspend).toBe(false);
      reset();
    },
    assertDidSuspend(yes: boolean){
      expect(didSuspend).toBe(yes);
      reset();
    }
  }
}

export function mockHook(
  callback: (props: {}) => any,
  provide?: Model){

  const opts = {} as {
    wrapper?: WrapperComponent<{}> | undefined;
  };

  if(provide)
    opts.wrapper = ({ children }) => (
      <Provider for={provide}>
        {children}
      </Provider>
    )

  return renderHook(callback, opts);
}