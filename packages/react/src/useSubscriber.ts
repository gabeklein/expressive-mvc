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

    const sub = new Subscriber(instance, () => update);
    const spy = sub.proxy as T;

    let compute: (() => R | undefined) | undefined =
      () => arg1!.call(spy, spy, forceUpdate)

    function forceUpdate(): void;
    function forceUpdate(passthru?: Promise<any> | (() => Promise<any>)): Promise<any>;
    function forceUpdate(passthru?: Promise<any> | (() => Promise<any>)){
      if(typeof passthru == "function")
        passthru = passthru();

      if(compute)
        reassign(compute());
      else
        refresh();

      if(passthru)
        return passthru.finally(refresh);
    }

    function reassign(next: any){
      value = next;

      if(retry) {
        retry();
        retry = undefined;
      }
      else
        refresh();
    };

    let retry: (() => void) | undefined;
    let update: (() => void) | undefined;
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
      value.then(reassign);
      value = undefined;
    }
    else {
      sub.commit();
      update = () => {
        const next = compute!();

        if(notEqual(value, next))
          reassign(next);
      };
    }

    Object.defineProperty(sub, "proxy", {
      get() {
        if(value !== undefined)
          return value;

        if(arg2)
          throw new Promise<void>(res => retry = res);

        return null;
      }
    });

    return sub;
  }, [instance]);

  if(!local)
    return null;

  useLayoutEffect(() => {
    local.commit();
    return () => local.release();
  }, [instance]);

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