import { Model, effect } from '@expressive/mvc';

import { useContext, useFactory, useOnMount } from './useContext';

export function useRemote<T extends Model, R>(
  this: Model.Type<T>,
  argument?: boolean | Model.GetFactory<T, unknown>
){
  const context = useContext()
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
      useOnMount(() => release);
      return value === undefined ? null : value;
    }
  });

  return get() as R;
}