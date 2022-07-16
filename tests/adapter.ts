import { createElement, Suspense } from 'react';
import { create as render } from 'react-test-renderer';

import * as Source from '../src';

export { renderHook } from '@testing-library/react-hooks';
export { create as render } from "react-test-renderer";

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

export function mockTimeout(ms = 0){
  return new Promise(res => setTimeout(res, ms));
}

export async function ensure<T>(suspense: () => T){
  try {
    suspense();
    throw new Error("Expected suspense.");
  }
  catch(err){
    if(err instanceof Promise)
      return err as Promise<T>;
    else
      throw err;
  }
}