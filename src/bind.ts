import type Public from '../types';

import { createElement, useCallback, useEffect, useMemo } from 'react';

import Oops from './issues';
import { Controller } from './controller';
import { createHocFactory } from './hoc';
import { define } from './util';

export function setBoundComponent(
  Type: Public.Component<{}, HTMLElement>, to: string){

  return Controller.define((key, on) => {
    const componentFor = createHocFactory<any>(Type);

    const Component = (props: {}) => {
      const ref = useBindRef(on, key);
      const Component = useMemo(() => componentFor(ref), []);
  
      return createElement(Component, props);
    }

    define(on.subject, key, Component);
  })
}

export function useBindRef(
  control: Controller, key: string){

  let cleanup: Callback | undefined;

  const ref = useCallback((e: HTMLElement | null) => {
    if(cleanup){
      cleanup();
      cleanup = undefined;
    }
    if(e instanceof HTMLInputElement)
      cleanup = createTwoWayBinding(e, control, key);
    else if(e)
      cleanup = createOneWayBinding(e, control, key);
  }, []);

  useEffect(() => {
    if(!cleanup)
      throw Oops.BindRefNotFound(control.constructor.name, key);
    else
      return () => cleanup!();
  }, []);

  return ref;
}

function createOneWayBinding(
  element: HTMLElement, parent: Controller, key: string){

  return parent.on(key as any, (v) => {
    element.innerHTML = String(v);
  }, true)
}

function createTwoWayBinding(
  input: HTMLInputElement, parent: Controller, key: string){

  function onUpdate(this: typeof input){
    (parent as any)[key] = this.value;
  }

  const release = 
    parent.on(key as any, (v) => {
      input.value = String(v);
    }, true);

  input.addEventListener("input", onUpdate);

  return () => {
    release();
    input.removeEventListener("input", onUpdate);
  };
}