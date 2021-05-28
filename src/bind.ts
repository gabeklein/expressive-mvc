import type Public from '../types';
import type { Model } from "./model";

import { createElement, useCallback, useEffect, useMemo } from 'react';

import Oops from './issues';
import { Controller } from './controller';
import { createHocFactory } from './hoc';
import { define, defineProperty, entries } from './util';

export function createBindAgent(
  requestedBy: Model){

  const instance = requestedBy.get;
  const tracked = entries(instance.export());
  const bind = {};

  tracked.forEach(([ name, value ]) => {
    if(typeof value === "string")
      defineProperty(bind, name, {
        get: () => useBindRef(instance, name)
      });
  });

  define(instance, { bind });

  return bind;
}

export function setBoundComponent
  (Type: Public.Component<{}, HTMLElement>, to: string){

  return Controller.define((key, { subject }) => {
    const componentFor = createHocFactory<any>(Type);

    const Component = (props: {}) => {
      const ref = useBindRef(subject as any, key);
      const Component = useMemo(() => componentFor(ref), []);
  
      return createElement(Component, props);
    }

    define(subject, key, Component);
  })
}

function useBindRef(
  control: Model, key: string){

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
  element: HTMLElement, parent: Model, key: string){

  return parent.on(key as any, (v) => {
    element.innerHTML = String(v);
  }, true)
}

function createTwoWayBinding(
  input: HTMLInputElement, parent: Model, key: string){

  function onUpdate(this: typeof input){
    parent.update({ [key]: this.value });
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