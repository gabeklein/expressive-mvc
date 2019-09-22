import { Controller } from './controller';
import { BunchOf, UpdateTrigger } from './types';
import { SpyController } from './subscriber';
import { Set } from './polyfill';

const { 
  defineProperty: define, 
  getOwnPropertyDescriptor: describe
} = Object;

const { random } = Math;

const TOGGLEABLE = /^is[A-Z]/;

export const NEW_SUB = "__init_subscription__";
export const UNSUBSCRIBE = "__delete_subscription__";
export const SUBSCRIBE = "__activate_subscription__";

export function applyDispatch(control: Controller){
  const mutable = {} as BunchOf<any>;
  const register = {} as BunchOf<Set<UpdateTrigger>>;

  const pending = Set<string>();
  let isPending = false;

  for(const key of Object.getOwnPropertyNames(control)){
    const d = describe(control, key)!;

    if(d.get || d.set || typeof d.value === "function" || key[0] === "_")
      continue;

    mutable[key] = d.value;
    register[key] = Set();

    define(control, key, {
      get: () => mutable[key],
      set: enqueue(key),
      enumerable: true,
      configurable: false
    })

    if(TOGGLEABLE.test(key) && typeof d.value == "boolean")
      define(control, key.replace(/is/, "toggle"), {
        value: setToggle(key)
      })
  }

  define(control, "hold", {
    get: () => isPending,
    set: to => isPending = to
  })

  define(control, "get", { value: control });
  define(control, "set", { value: control });

  define(control, NEW_SUB, { 
    value: (hook: UpdateTrigger) => 
      SpyController(control, hook, mutable, register)
  })

  define(control, "refresh", { 
    value: function refreshSubscribersOf(...watching: string[]){
      for(const x of watching)
        pending.add(x)
      refresh();
    }
  });

  define(control, "export", {
    value: function exportCurrentValues(){
      const acc = {} as BunchOf<any>;
      for(const key in this){
          const { value } = describe(this, key)!;
          if(value)
            acc[key] = value;
      }
      for(const key in mutable)
        acc[key] = mutable[key]

      return acc;
    }
  })

  function refresh(){
    if(isPending)
        return;
    isPending = true;
    setTimeout(dispatch, 0)
  }

  function setToggle(key: string){
    return function toggle(to?: boolean){
      mutable[key] = !mutable[key]
      pending.add(key);
      refresh();
    }
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
    const inform = Set<UpdateTrigger>();
    for(const key of pending)
      for(const sub of register[key] || [])
        inform.add(sub);

    for(const refresh of inform)
      refresh(random());

    pending.clear();
    isPending = false;
  }
}