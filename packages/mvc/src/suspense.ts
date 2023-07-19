import { Control } from './control';
import { issues } from './helper/issues';
import { assign } from './helper/object';

export const Oops = issues({
  NotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`,

  Destoryed: () => "Model is destroyed."
})

export function suspense(source: Control, key: string): Promise<void> & Error {
  const error = Oops.NotReady(source.subject, key);
  const promise = new Promise<void>((resolve, reject) => {
    function check(){
      if(source.state[key] !== undefined){
        remove();
        resolve();
      }
    }

    const remove = source.addListener(k => {
      if(k === key)
        return check;

      if(k === null)
        reject(Oops.Destoryed());
    });
  });

  return assign(promise, {
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