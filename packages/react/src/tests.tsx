import { Model } from '@expressive/mvc';
import { act, create } from 'react-test-renderer';
import React from 'react';

import { Provider } from './provider';

export function mockAsync<T = void>(){
  const pending = new Set<[Function, Function]>();

  const event = () =>
    new Promise<T>((res, rej) => pending.add([res, rej]))

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

export function mockHook<T>(
  callback: (props: {}) => T,
  provide?: Model){

  let value: T;
  let waiting: (value: T) => void;

  const Component = () => {
    value = callback({});

    if(waiting)
      waiting(value);

    return null;
  }

  let element = <Component />;

  if(provide)
    element = (
      <Provider for={provide}>
        {element}
      </Provider>
    );

  const mounted = create(element);

  return {
    get current(){
      return value
    },
    waitFor(fn?: () => void | Promise<void>){
      return act(async () => {
        const pending = new Promise(res => waiting = res);
        await new Promise(res => setTimeout(res, 10));
        if(fn)
          await fn();
        await pending;
      })
    },
    update(to?: (props: {}) => T){
      if(to){
        callback = to;
        mounted.update(element);
      }

      return this.waitFor();
    },
    unmount(){
      mounted.unmount();
      return new Promise(res => setTimeout(res, 10));
    },
  }
}

export interface MockPromise<T> extends Promise<T> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

export function mockPromise<T = void>(){
  const methods = {} as MockPromise<T>;
  const promise = new Promise((res, rej) => {
    methods.resolve = res;
    methods.reject = rej;
  }) as MockPromise<T>;

  return Object.assign(promise, methods);
}