import type { Controller } from "./controller";
import { useEffect, useCallback } from 'react';

import Oops from "./issues";

export function useBindRef(
  control: Controller, key: string){

  let cleanup: Callback | undefined;

  const ref = useCallback((e: HTMLElement | null) => {
    if(cleanup){
      cleanup();
      cleanup = undefined as any;
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