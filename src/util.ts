import { issues } from './issues';
import { Model } from './model';

import type { Callback } from './types';

export const Oops = issues({
  BadCallback: () =>
    `Callback for effect-callback may only return a function.`
})

const {
  assign,
  create,
  defineProperty,
  entries,
  getPrototypeOf,
  getOwnPropertyNames,
  getOwnPropertyDescriptor,
  getOwnPropertySymbols,
  values
} = Object;

export {
  assign,
  create,
  defineProperty,
  entries,
  getPrototypeOf,
  getOwnPropertyDescriptor,
  getOwnPropertyNames,
  getOwnPropertySymbols,
  values
}

export function createEffect(
  callback: Model.Effect<any>){

  let unSet: Callback | Promise<any> | void;

  return function(this: any, value: any){
    if(typeof unSet == "function")
      unSet();

    unSet = callback.call(this, value);

    if(unSet instanceof Promise)
      unSet = undefined;

    if(unSet && typeof unSet !== "function")
      throw Oops.BadCallback()
  }
}

export type AssignCallback<T> =
  (this: any, argument: T, thisArg: any) =>
    ((next: T) => void) | Promise<any> | void | boolean;

export function createValueEffect<T = any>(
  callback: AssignCallback<T>){

  let unSet: ((next: T) => void) | undefined;

  return function(this: any, value: any){
    if(typeof unSet == "function")
      unSet(value);

    const out = callback.call(this, value, this);

    if(typeof out == "boolean")
      return out;

    if(!out || out instanceof Promise)
      return;

    if(typeof out == "function")
      unSet = out;
    else
      throw Oops.BadCallback()
  }
}