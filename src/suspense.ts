import { Controller } from './controller';
import { issues } from './issues';

export const Oops = issues({
  ValueNotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`
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
  via: Controller,
  key: string,
  fn: (key: string, subject: unknown) => any){

  const { subject, state } = via;
  let waiting: Promise<any> | undefined;
  let error: any;

  return () => {
    if(waiting)
      throw waiting;

    if(error)
      throw error;

    if(key in state)
      return state[key];

    let output;

    try {
      output = fn.call(subject, key, subject);
    }
    catch(err){
      throw error = err;
    }

    if(output instanceof Promise){
      const issue =
        Oops.ValueNotReady(subject, key);

      output
        .catch(err => error = err)
        .then(out => state[key] = out)
        .finally(() => waiting = undefined)

      throw waiting = Object.assign(output, {
        message: issue.message,
        stack: issue.stack
      });
    }
    else {
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