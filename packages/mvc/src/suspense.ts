import { control } from './control';
import { assign } from './helper/object';
import { Model } from './model';

export function suspense<T extends Model>(
  subject: T, key: Model.Key<T>): Promise<void> & Error {

  const self = control(subject);
  const error = new Error(`${subject}.${key} is not yet available.`);
  const promise = new Promise<void>((resolve, reject) => {
    function check(){
      if(self.state[key] !== undefined){
        remove();
        resolve();
      }
    }

    const remove = self.addListener((k: unknown) => {
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