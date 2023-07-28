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

  create(element);

  async function waitFor(fn: () => void | Promise<void>){
    return act(async () => {
      const pending = new Promise(res => waiting = res);
      await new Promise(res => setTimeout(res, 10));
      await fn();
      await pending;
    })
  }

  return {
    get current(){
      return value
    },
    waitFor
  }
}

export async function mockAsyncHook<T>(
  callback: (props: {}) => T,
  provide?: Model){

  const render = mockHook(callback, provide);

  await new Promise(res => setTimeout(res, 0));
  
  return render;
}