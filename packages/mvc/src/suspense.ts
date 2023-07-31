import { Control, addListener } from './control';
import { assign } from './helper/object';

export function suspense(source: Control, key: string): Promise<void> & Error {
  const error = new Error(`${source.subject}.${key} is not yet available.`);
  const promise = new Promise<void>((resolve, reject) => {
    function check(){
      if(source.state[key] !== undefined){
        remove();
        resolve();
      }
    }

    const remove = addListener(source.subject, k => {
      if(k === key)
        return check;

      if(k === null)
        reject(new Error(`${source.subject} is destroyed.`));
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