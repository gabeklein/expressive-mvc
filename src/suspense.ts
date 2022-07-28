import { Controller } from './controller';
import { issues } from './issues';

export const Oops = issues({
  NotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`,
})

type Suspense<T = any> = Promise<T> & Error;

export function suspend(
  source: Controller, key: string): Suspense {

  const error =
    Oops.NotReady(source.subject, key);

  const promise = new Promise<void>(resolve => {
    const release = source.addListener(forKey => {
      if(forKey == key)
        return () => {
          if(source.state.get(key) !== undefined){
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

export function mayRetry(fn: () => any): any {
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