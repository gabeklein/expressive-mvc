import { addListener, getState } from './control';
import { assign } from './helper/object';
import { Model } from './model';

export function suspense(subject: Model, key: string): Promise<void> & Error {
  const state = getState(subject);
  const error = new Error(`${subject}.${key} is not yet available.`);
  const promise = new Promise<void>((resolve, reject) => {
    function check(){
      if(state[key] !== undefined){
        remove();
        resolve();
      }
    }

    const remove = addListener(subject, k => {
      if(k === key)
        return check;

      if(k === null)
        reject(new Error(`${subject} is destroyed.`));
    });
  });

  return assign(promise, {
    toString: () => String(error),
    name: "Suspense",
    message: error.message,
    stack: error.stack
  });
}

export function attempt(fn: () => any): any {
  const retry = (err: unknown) => {
    if(err instanceof Promise)
      return err.then(compute);
    else
      throw err;
  }

  const compute = (): any => {
    try {
      const output = fn();

      return output instanceof Promise
        ? output.catch(retry)
        : output;
    }
    catch(err){
      return retry(err);
    }
  }

  return compute();
}