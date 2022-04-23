import { createElement, Suspense } from 'react';
import { create as render } from 'react-test-renderer';

import * as Source from '../src';

export { renderHook } from '@testing-library/react-hooks';
export { create as render } from "react-test-renderer";

export {
  Model,
  Global,
  Provider,
  Consumer,
  act,
  apply,
  set,
  ref,
  tap,
  from,
  parent,
  use
} from "../src";

export function subscribeTo<T extends Source.Model>(
  target: T,
  accessor: (self: T) => void){

  const didTrigger = jest.fn();

  target.effect(self => {
    accessor(self);
    didTrigger();
  });

  // ignore initial scan-phase
  didTrigger.mockReset();
  
  return async (isExpected = true) => {
    await new Promise(res => setTimeout(res, 0));

    if(isExpected){
      expect(didTrigger).toHaveBeenCalled();
      didTrigger.mockReset();
    }
    else
      expect(didTrigger).not.toHaveBeenCalled();
  }
}

export function mockAsync<T = void>(){
  const pending =
    new Set<[Function, Function]>();

  return {
    await: () => (
      new Promise<T>((res, rej) => {
        pending.add([res, rej]);
      })
    ),
    resolve: (value: T) => {
      pending.forEach(x => x[0](value));
      pending.clear();
    }
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
      return promise.await();
    },
    renderHook(fn: () => void){
      renderHook = fn;
  
      render(
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