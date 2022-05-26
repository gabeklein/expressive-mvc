import { Controller } from './controller';
import { issues } from './issues';

export const Oops = issues({
  ValueNotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`,
})

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