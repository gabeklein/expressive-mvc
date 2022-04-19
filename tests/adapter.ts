import { createElement, Suspense } from 'react';
import { create as render } from 'react-test-renderer';

import * as Public from '../';
import * as Source from '../src';

export { renderHook } from '@testing-library/react-hooks';
export { create as render } from "react-test-renderer";

export const Model = Source.Model as unknown as typeof Public.Model;
export const Singleton = Source.Singleton as unknown as typeof Public.Singleton;
export const Provider = Source.Provider as unknown as typeof Public.Provider;
export const Consumer = Source.Consumer as unknown as typeof Public.Consumer;

export const apply = Source.apply as typeof Public.apply;
export const set = Source.set as typeof Public.set;
export const tap = Source.tap as typeof Public.tap;
export const on = Source.on as typeof Public.on;
export const ref = Source.ref as typeof Public.ref;
export const use = Source.use as typeof Public.use;
export const act = Source.act as typeof Public.act;
export const from = Source.from as typeof Public.from;
export const parent = Source.parent as typeof Public.parent;
export const pending = Source.pending as typeof Public.pending;

export function subscribeTo<T extends Public.Model>(
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