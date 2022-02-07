import { set } from './assign';
import { Controller } from './controller';
import { from } from './instructions';
import { issues } from './issues';
import { Model } from './model';

export const Oops = issues({
  ValueNotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`
})

type ComputeFunction<T, O = any> = (this: O, on: O) => T;

/* deprecated - ignore coverage */
/* istanbul ignore next */
export function pending<T = void>(
  source: (() => Promise<T>) | Model | typeof Model,
  compute?: ComputeFunction<T>){

  if(source === undefined)
    return set();

  if(typeof source == "function" && !source.prototype)
    return set(source as any);

  return from(source as any, compute, true);
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

export function pendingFactory(
  this: Controller,
  fn: (key: string, subject: unknown) => any,
  key: string
){
  const { subject, state } = this;
  let waiting: undefined | Promise<any> | false;
  let error: any;

  return () => {
    if(waiting)
      throw waiting;

    if(error)
      throw error;

    if(waiting === false)
      return state[key];

    let output;

    try {
      output = fn.call(subject, key, subject);
    }
    catch(err){
      error = err;
      waiting = false;
      throw err;
    }

    if(output instanceof Promise){
      const issue =
        Oops.ValueNotReady(subject, key);

      output
        .catch(err => error = err)
        .then(out => state[key] = out)
        .finally(() => waiting = false)

      throw waiting = Object.assign(output, {
        message: issue.message,
        stack: issue.stack
      });
    }
    else {
      waiting = false;
      return state[key] = output;
    }
  }
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