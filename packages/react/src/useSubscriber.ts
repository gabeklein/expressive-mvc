import { Model, Subscriber } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';

function useSubscriber<T extends Model, R>(
  instance: T,
  arg1?: Model.GetCallback<T, any>,
  arg2?: boolean){

  const state = useState(0);
  const local = useMemo(() => {
    const refresh = state[1].bind(null, x => x+1);

    if(!arg1)
      return new Subscriber(instance, () => refresh);

    let dropSuspense: (() => void) | undefined;
    let update: (() => void) | undefined;

    const sub = new Subscriber(instance, () => update);
    const spy = sub.proxy as T;

    let compute: (() => R | undefined) | undefined =
      () => arg1!.call(spy, spy, forceUpdate)

    let value = compute();

    if(value === null){
      sub.watch.clear();
      compute = undefined;
      return;
    }

    if(typeof value == "function"){
      const get = value;

      sub.watch.clear();
      arg1 = () => get();
      value = get();
    }

    if(value instanceof Promise) {
      value.then(didUpdate);
      value = undefined;
    }
    else {
      sub.commit();
      update = () => {
        const next = compute!();

        if(notEqual(value, next))
          didUpdate(next);
      };
    }

    return {
      commit: sub.commit,
      get proxy(){
        if(value !== undefined)
          return value;

        if(arg2)
          throw new Promise<void>(res => {
            dropSuspense = res;
          });

        return null;
      }
    };

    function forceUpdate(): void;
    function forceUpdate<T>(passthru: Promise<T> | (() => Promise<T>)): Promise<T>;
    function forceUpdate<T>(passthru?: Promise<T> | (() => Promise<T>)){
      if(typeof passthru == "function")
        passthru = passthru();

      if(compute)
        didUpdate(compute());
      else
        refresh();

      if(passthru)
        return passthru.finally(refresh);
    }

    function didUpdate(next: any){
      value = next;

      if(dropSuspense) {
        dropSuspense();
        dropSuspense = undefined;
      }
      else
        refresh();
    };
  }, [instance]);

  if(!local)
    return null;

  useLayoutEffect(local.commit, [instance]);

  return local.proxy;
}

/** Values are not equal for purposes of a refresh. */
const notEqual = <T>(a: T, b: unknown) => (
  b !== a && (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length !== b.length ||
    a.some((x, i) => x !== b[i])
  )
)

export { useSubscriber }