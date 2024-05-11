import { effect, Model } from '@expressive/mvc';

import { useContext, useFactory, useMount } from './useContext';

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

    /** Fetch instance of this class from context. */
    function get <T extends Model> (this: Model.Type<T>): T;
  
    /** Fetch instance of this class optionally. */
    function get <T extends Model> (this: Model.Type<T>, expect: false): T | undefined;

    /** Fetch instance of this class from context. */
    function get <T extends Model> (this: Model.Type<T>, expectValues: true): Required<T>
  
    function get <T extends Model, R> (this: Model.Type<T>, factory: GetFactory<T, Promise<R> | R>): NoVoid<R>;
  
    function get <T extends Model, R> (this: Model.Type<T>, factory: GetFactory<T, null>): NoVoid<R> | null;
  }
}

Model.get = function <T extends Model, R> (
  this: Model.Type<T>,
  argument?: boolean | Model.GetFactory<T, unknown>
){
  const context = useContext();
  const get = useFactory((refresh) => {
    const instance = context.get(this);

    if(!instance)
      if(argument === false)
        return () => {};
      else
        throw new Error(`Could not find ${this} in context.`);

    function forceUpdate(): void;
    function forceUpdate<T>(action: Promise<T> | (() => Promise<T>)): Promise<T>;
    function forceUpdate<T>(action?: Promise<T> | (() => Promise<T>)){
      if(typeof action == "function")
        action = action();

      refresh();

      if(action)
        return action.finally(refresh);
    }

    let release: (() => void) | undefined;
    let value: any;

    release = effect(instance, current => {
      if(typeof argument === "function"){
        const next = argument.call(current, current, forceUpdate);

        if(next === value)
          return;

        value = next;
      }
      else
        value = current;

      if(release)
        refresh();
    }, argument === true);

    if(value instanceof Promise){
      let error: Error | undefined;

      release();

      // TODO: ignore update if resolves to undefined or null
      value.then(x => value = x).catch(e => error = e).finally(refresh);
      value = null;

      return () => {
        if(error)
          throw error;

        return value === undefined ? null : value;
      }
    }

    if(value === null){
      release();
      return () => null;
    }

    return () => {
      useMount(() => release);
      return value === undefined ? null : value;
    }
  });

  return get() as R;
}