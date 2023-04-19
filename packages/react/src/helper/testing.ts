import { createElement, Suspense } from 'react';
import { create } from 'react-test-renderer';

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

export function mockSuspense(){
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

      create(
        createElement(Suspense, {
          fallback: createElement(Waiting),
          children: createElement(Component)
        })
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
    }
  }
}