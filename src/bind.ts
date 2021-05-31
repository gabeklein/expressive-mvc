import type Public from '../types';

import { createElement, useCallback, useEffect, useMemo } from 'react';

import { Controller } from './controller';
import { createHocFactory } from './hoc';
import { define, defineProperty } from './util';

export function setBoundComponent(
  Type: Public.Component<{}, HTMLElement>, to: string){

  return Controller.define((key, on) => {
    const componentFor = createHocFactory<any>(Type);

    const Component = (props: {}) => {
      let reset: Callback | undefined;

      const ref = useCallback<RefFunction>((e) => {
        if(reset){
          reset();
          reset = undefined;
        }
        if(e)
          reset = createBinding(e, on, to);
      }, []);

      const Component = useMemo(() => componentFor(ref), []);

      useEffect(() => () => reset && reset(), []);
  
      return createElement(Component, props);
    }

    define(on.subject, key, Component);
  })
}

type RefFunction = (e: HTMLElement | null) => void;

export function bindRefFunctions(on: Controller){
  const proxy: BunchOf<RefFunction> = {};

  let index = 0;
  const gc = new Set<Callback>();
  const refs = [] as ((e: HTMLElement | null) => void)[];

  for(const key in on.export()){
    function bind(){
      let cleanup: Callback | undefined;

      return (e: HTMLElement | null) => {
        if(cleanup){
          cleanup();
          gc.delete(cleanup);
          cleanup = undefined;
        }
        if(e){
          cleanup = createBinding(e, on, key);
          gc.add(cleanup);
        }
      }
    }

    defineProperty(proxy, key, {
      get(){
        if(index > refs.length)
          index = 0;
  
        return refs[index++] || (
          refs[index - 1] = bind()
        );
      }
    })
  }

  return {
    proxy,
    listen(){},
    release(){
      gc.forEach(x => x());
    }
  }
}

export function createBinding(
  e: HTMLElement,
  control: Controller,
  key: string){

  if(e instanceof HTMLInputElement)
    return createTwoWayBinding(e, control, key);
  else
    return createOneWayBinding(e, control, key);
}

function createOneWayBinding(
  element: HTMLElement, parent: Controller, key: string){

  return parent.on(key as any, (v) => {
    element.innerHTML = String(v);
  }, true)
}

function createTwoWayBinding(
  input: HTMLInputElement, parent: Controller, key: string){

  let last: any;

  function onUpdate(this: typeof input){
    last = (parent.subject as any)[key] = this.value;
  }

  const release = 
    parent.on(key as any, (v) => {
      if(v !== last)
        input.value = String(v);
    }, true);

  input.addEventListener("input", onUpdate);

  return () => {
    release();
    input.removeEventListener("input", onUpdate);
  };
}