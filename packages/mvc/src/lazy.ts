// import Model from '../../react/src';

import { Model } from "./model";

/** Type may not be undefined - instead will be null.  */
// type NoVoid<T> = T extends undefined | void ? null : T;

export interface Lazy<T extends Model> {
  new(...args: Model.Args<T>): Promise<T>;

  // get(): T;
  
  // get(expect: false): T | undefined;

  // get(expectValues: true): Required<T>

  // get<R>(factory: Model.get.Factory<T, Promise<R> | R>): NoVoid<R>;

  // get<R>(factory: Model.get.Factory<T, null>): NoVoid<R> | null;
}

function lazy<T extends Model>(
  factory: () => Promise<Model.Type<T> | { default: Model.Type<T> }>
): Lazy<T> {
  let Type: Model.Type<T> | Error | undefined;

  function Constructor(...args: Model.Args){
    if(!Type)
      return factory().then(m => {
        if(typeof m !== "function")
          m = m.default;

        if(!Model.is(m))
          return new Error(`Expected a typeof Model, but got ${m}.`);

        Type = m;

        return new Type(...args) as T;
      }).catch(e => {
        Type = e;
        throw e;
      });

    if(Type instanceof Error)
      throw Type;

    return new Type(...args) as T;
  }

  return Constructor as any;
}

export { lazy }