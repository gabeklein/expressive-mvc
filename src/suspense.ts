import { set } from './assign';
import { Controller, manage } from './controller';
import { from } from './instructions';
import { issues } from './issues';
import { Model } from './model';

export const Oops = issues({
  ValueNotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`
})

type ComputeFunction<T, O = any> = (this: O, on: O) => T;

export function pending<T = void>(
  source: (() => Promise<T>) | Model | typeof Model,
  compute?: ComputeFunction<T>){

  return (
    source === undefined ?
      set() :
    typeof source == "function" && !source.prototype ?
      set(source, true) :
      suspendForComputed(source as any, compute)
  )
}

/**
 * Get value, suspend instead if undefined.
 * 
 * Throws suspense promise also interpretable as an error.
 * React could handle it but other contexts probably not.
 */
export function pendingValue<T = any>(
  via: Controller, key: string): T {

  const value = via.state[key];

  if(value === undefined)
    throw suspend(via, key);

  return value;
}

type Suspense<T = any> = Promise<T> & Error;

export function suspend(
  source: Controller, key: string): Suspense {

  const error =
    Oops.ValueNotReady(source.subject, key);

  const promise = new Promise<void>(resolve => {
    const release = source.addListener(forKey => {
      if(forKey == key)
        return () => {
          if(source.state[key] !== undefined){
            release();
            resolve();
          }
        }
    });
  });

  return Object.assign(promise, {
    toString: () => String(error),
    name: "Suspense",
    message: error.message,
    stack: error.stack
  });
}

function suspendForComputed<T>(
  source: Model | typeof Model,
  compute?: ComputeFunction<T>){

  function getter(
    this: Model, _value: any, key: string){

    return pendingValue(manage(this), key);
  }

  return from(source, compute, getter);
}