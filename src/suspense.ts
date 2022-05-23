import { Controller } from './controller';
import { issues } from './issues';
import { suspenseBoundary } from './util';

export const Oops = issues({
  ValueNotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`,

    FactoryFailed: (model, key) =>
      `Generating initial value for ${model}.${key} failed.`
})

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
  parent: Controller,
  key: string,
  fn: (key: string, subject: unknown) => any,
  immediate: boolean){

  const { subject, state } = parent;
  let pending: Promise<any> | undefined;
  let error: any;

  const init = () => {
    const output = suspenseBoundary(() => {
      return fn.call(subject, key, subject);
    });

    if(output instanceof Promise){
      pending = output
        .catch(err => error = err)
        .then(val => state[key] = val)
        .finally(() => {
          pending = undefined;
          parent.update(key);
        })
  
      const issue =
        Oops.ValueNotReady(subject, key);

      Object.assign(pending, {
        message: issue.message,
        stack: issue.stack
      });
    }

    return state[key] = output;
  }

  if(immediate)
    try {
      init();
    }
    catch(err){
      Oops.FactoryFailed(subject, key).warn();
      throw err;
    }

  return () => {
    if(pending)
      throw pending;

    if(error)
      throw error;

    if(key in state)
      return state[key];

    let output = init();

    if(pending)
      throw pending;
    else
      return output;
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