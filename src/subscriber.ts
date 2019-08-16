import { Context, useContext, useEffect, useRef, useState } from 'react';

import { Controller } from './controller';
import { BunchOf, UpdateTrigger } from './types';

const { 
  defineProperty: define, 
  getOwnPropertyDescriptor: describe, 
  create,
  assign
} = Object;

const { random } = Math;

export const NEW_SUB = Symbol("init_subscription");
export const UNSUBSCRIBE = Symbol("delete_subscription");
export const SUBSCRIBE = Symbol("activate_subscription");

export interface SpyController extends Controller {
  [UNSUBSCRIBE]: VoidFunction;
  [SUBSCRIBE]: VoidFunction;
};

export function useContextSubscriber<T extends Controller>
  (context: Context<Controller>): InstanceType<T> {

  const firstRenderIs = useRef(true);
  const useUpdate = useState(0);
  let controller = useContext(context) as Controller | SpyController;

  if(firstRenderIs.current){
    const init = controller[NEW_SUB];
    if(!init){
      const { name } = controller.constructor;
      throw new Error(
        `Can't subscribe to controller;` +
        ` this accessor can only be used within { Provider } given to you by \`${name}.use()\``
      )
    }

    controller = init(useUpdate[1]) as SpyController;
    firstRenderIs.current = false
  }

  useEffect(() => {
    const initialRenderControl = 
      controller as SpyController;

    initialRenderControl[SUBSCRIBE]();
    return () => 
      initialRenderControl[UNSUBSCRIBE]();
  }, [])

  return controller as any;
}

function SpyController(
  source: Controller, 
  hook: UpdateTrigger,
  mutable: BunchOf<any>,
  register: BunchOf<Set<UpdateTrigger>>
): SpyController {

  const Spy = create(source) as any;
  let watch = new Set<string>();
  let exclude: string[];

  for(const key in mutable)
    define(Spy, key, {
      set: describe(source, key)!.set,
      get(){
        watch.add(key);
        return mutable[key];
      }
    })

  define(Spy, SUBSCRIBE, { value: sub });
  define(Spy, UNSUBSCRIBE, { value: unSub });
  define(Spy, "only", { value: bail });
  define(Spy, "on", { value: also });
  define(Spy, "never", { value: () => source });
  define(Spy, "except", { value: except });

  return Spy;

  function sub(){
    if(exclude)
    for(const k of exclude)
      watch.delete(k);

    for(const key of watch)
      register[key].add(hook);
  }

  function unSub(){
    for(const key of watch)
      register[key].delete(hook);
  }

  function bail(...keys: string[]){
    watch = new Set(keys);
    for(const key of watch)
      register[key].add(hook);
    return source;
  }

  function except(...keys: string[]){
    exclude = keys;
    return Spy;
  }

  function also(...keys: string[]){
    for(const key of keys)
      watch.add(key);
    return Spy;
  }
}

export function Dispatch(this: Controller){
  const mutable = {} as any;
  const register = {} as BunchOf<Set<UpdateTrigger>>;

  const pending = new Set<string>();
  let isPending = false;

  for(const key in this){
    const d = describe(this, key)!;

    if(d.get || d.set || typeof d.value === "function" || key[0] === "_")
      continue

    mutable[key] = d.value;
    register[key] = new Set();
    define(this, key, {
      get: () => mutable[key],
      set: enqueue(key),
      enumerable: true,
      configurable: false
    })
  }

  define(this, NEW_SUB, { 
    value: (hook: UpdateTrigger) => 
      SpyController(this, hook, mutable, register)
  })

  define(this, "refresh", { 
    value(...watching: string[]){
      for(const x of watching)
        pending.add(x)
      refresh();
    }
  });

  define(this, "export", {
    value(){
      const acc = {} as BunchOf<any>;
      for(const key in this){
          const { value } = describe(this, key)!;
          if(value)
            acc[key] = value;
      }
      return assign(acc, mutable);
    }
  })

  function refresh(){
    if(isPending)
        return;
    isPending = true;
    setTimeout(dispatch, 0)
  }

  function enqueue(to: string){
    return (value: any) => {
      if(mutable[to] === value) 
          return;

      mutable[to] = value;
      pending.add(to);

      refresh();
    }
  }

  function dispatch(){
    const inform = new Set<UpdateTrigger>();
    for(const key of pending)
      for(const sub of register[key] || [])
        inform.add(sub);

    for(const refresh of inform)
      refresh(random());

    pending.clear();
    isPending = false;
  }
}