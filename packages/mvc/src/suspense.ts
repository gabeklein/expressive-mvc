import { Control } from './control';
import { issues } from './helper/issues';
import { assign } from './helper/object';
import { Model } from './model';

export const Oops = issues({
  NotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`,

  Destoryed: () => "Model is destroyed."
})

export function suspense(
  source: Control, key: string): Model.Suspense {

  const error = Oops.NotReady(source.subject, key);

  const promise = new Promise<void>((resolve, reject) => {
    const subs = source.observers.get(key)!;
    const onUpdate = (key: string | null) => {
      if(key)
        return () => {
          if(source.state.get(key) !== undefined){
            subs.delete(onUpdate);
            resolve();
          }
        };

      reject(Oops.Destoryed());
    }

    subs.add(onUpdate)
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