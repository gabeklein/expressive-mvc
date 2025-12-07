import { createEffect, Model } from '@expressive/mvc';

import { Hook } from './adapter';
import { Context } from '@expressive/mvc';

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

type ForceRefresh = {
  /** Request a refresh for current component. */
  (): void;
  
  /**
   * Request a refresh and again after promise either resolves or rejects.
   * 
   * @param waitFor Promise to wait for.
   * @returns Promise which resolves, after refresh, to same value as `waitFor`.
   */
  <T = void>(waitFor: Promise<T>): Promise<T>;

  /**
   * Request refresh before and after async function.
   * A refresh will occur both before and after the given function.
   * 
   * **Note:** Any actions performed before first `await` will occur prior to refresh.
   * 
   * @param invoke Async function to invoke.
   * @returns Promise which resolves returned value after refresh.
   */
  <T = void>(invoke: () => Promise<T>): Promise<T>;
};

declare module '@expressive/mvc' {
  namespace Model {
    type GetFactory<T extends Model, R> =
      (this: T, current: T, refresh: ForceRefresh) => R;

    type GetEffect<T extends Model> =
      (this: T, current: T, refresh: ForceRefresh) => null;

    /** Fetch instance of this class from context. */
    function get <T extends Model> (this: Model.Type<T>): T;
  
    /** Fetch instance of this class optionally. */
    function get <T extends Model> (this: Model.Type<T>, required: false): T | undefined;

    /** Fetch instance of this class from context. */
    function get <T extends Model> (this: Model.Type<T>, requireValues: true): Required<T>
  
    function get <T extends Model, R> (this: Model.Type<T>, factory: GetFactory<T, Promise<R> | R>): NoVoid<R>;
  
    // TODO: eagerly metch this so any nulls are caught - would prevent updates.
    function get <T extends Model> (this: Model.Type<T>, factory: GetEffect<T>): null;
  }
}

Model.get = function <T extends Model, R> (
  this: Model.Type<T>,
  argument?: boolean | Model.GetFactory<T, unknown>
){
  const context = Context.use();
  const state = Hook.useState(() => {
    const refresh = () => state[1](x => x.bind(null));
    const instance = context.get(this);

    if(!instance)
      if(argument === false)
        return () => undefined;
      else
        throw new Error(`Could not find ${this} in context.`);

    let ready: boolean | undefined;
    let value: any;

    const unwatch = createEffect(instance, current => {
      if(typeof argument === "function"){
        const next = argument.call(current, current, update);

        if(next === value)
          return;

        value = next;
      }
      else
        value = current;

      if(ready)
        refresh();
    }, argument === true);

    if(value instanceof Promise){
      let error: Error | undefined;

      unwatch();

      value.then(x => value = x, e => error = e).finally(refresh);
      value = null;

      return () => {
        if(error)
          throw error;

        return value === undefined ? null : value;
      }
    }

    if(value === null){
      unwatch();
      return () => null;
    };

    function update<T>(action?: Promise<T> | (() => Promise<T>)): any {
      if(typeof action == "function")
        action = action();

      refresh();

      if(action)
        return action.finally(refresh);
    }

    function didMount(){
      ready = true;
      return unwatch;
    }

    return () => {
      Hook.useEffect(didMount, []);
      return value === undefined ? null : value;
    }
  });

  return state[0]() as R;
}