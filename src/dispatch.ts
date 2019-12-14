import { Controller } from './controller';
import { Set } from './polyfill';
import { SUBSCRIBE, Subscription } from './subscriber';
import { BunchOf, ModelController, SpyController, UpdateTrigger } from './types';

declare const setTimeout: (callback: () => void, ms: number) => number;

export const NEW_SUB = "__init_subscription__";
export const DISPATCH = "__subscription_dispatch__";
export const SOURCE = "__subscription_source__";

const { 
  defineProperty: define,
  defineProperties: defineThese, 
  getOwnPropertyDescriptor: describe,
  getOwnPropertyDescriptors: describeAll,
  getOwnPropertyNames: keysOf,
  getPrototypeOf: prototypeOf
} = Object;

const { random } = Math;

export function ensureDispatch(this: ModelController){
  const yeildSubsciptionWatcher = (hook: UpdateTrigger) =>
    Subscription(this, hook)
  
  if(DISPATCH in this === false)
    applyDispatch(this);

  define(this, NEW_SUB, {
    value: yeildSubsciptionWatcher
  });

  return yeildSubsciptionWatcher;
}

function gettersFor(prototype: any){
  const getters = {} as any;

  do {
    prototype = Object.getPrototypeOf(prototype);

    const described = describeAll(prototype);
    
    for(const item in described)
      if("get" in described[item] && !getters[item])
        getters[item] = described[item].get
  }
  while(prototype !== Object.prototype 
     && prototype !== Controller.prototype);

  return getters as BunchOf<Function>
}

export function applyDispatch(control: ModelController){
  const mutable = {} as BunchOf<any>;
  const register = {} as BunchOf<Set<UpdateTrigger>>;

  const pending = new Set<string>();
  let isPending = false;

  for(const key of keysOf(control)){
    const d = describe(control, key)!;

    if(d.get || d.set || typeof d.value === "function")
      continue;

    mutable[key] = d.value;
    register[key] = new Set();

    define(control, key, {
      get: () => mutable[key],
      set: setTrigger(key),
      enumerable: true,
      configurable: false
    })
  }

  const getters = gettersFor(control);

  defineThese(control, {
    [SOURCE]: { value: mutable },
    [DISPATCH]: { value: register }
  })

  for(const key in getters)
    if(key !== "Provider"
    && key !== "Value")
      createComputed(key);

  defineThese(control, {
    get: { value: control },
    set: { value: control },
    toggle: { value: toggle },
    refresh: { value: refreshSubscribersOf },
    export: { value: exportCurrentValues },
    hold: {
      get: () => isPending,
      set: to => isPending = to
    }
  })

  function createComputed(key: string){
    const recompute = () => {
      const value = getters[key].call(control);

      if(mutable[key] === value)
        return

      mutable[key] = value;
      pending.add(key);
      for(const sub of register[key] || [])
        sub(random());
    }

    recompute.immediate = true;

    const spy: SpyController = Subscription(control, recompute);
    mutable[key] = getters[key].call(spy);
    spy[SUBSCRIBE]();

    define(control, key, {
      set: () => { throw new Error(`Cannot set ${key} on this controller, it is computed.`) },
      get: () => getters[key].call(control),
      enumerable: true,
      configurable: true
    })
  }

  function toggle(key: string){
    return (control as any)[key] = !(control as any)[key]
  }

  function refreshSubscribersOf(...watching: string[]){
    for(const x of watching)
      pending.add(x)
    refresh();
  }

  function exportCurrentValues(this: BunchOf<any>){
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

  function refresh(){
    if(isPending)
        return;
    isPending = true;
    setTimeout(dispatch, 0)
  }

  function setTrigger(to: string){
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

export function applyExternal(
  this: ModelController,
  external: BunchOf<any>){

  if(DISPATCH in this === false)
    applyDispatch(this);

  const mutable = this[SOURCE];
  const inner = prototypeOf(this);

  for(const key of keysOf(external)){
    mutable[key] = external[key];
    define(inner, key, {
      get: () => mutable[key],
      set: willThrowUpdateIsForbidden(key),
      enumerable: true,
      configurable: false
    })
  }

  define(inner, "watch", {
    value: updateExternal,
    configurable: false
  })

  function updateExternal(
    this: ModelController,
    external: BunchOf<any>){

    let diff = [];

    for(const key of keysOf(external)){
      if(external[key] == mutable[key])
        continue;
      mutable[key] = external[key];
      diff.push(key);
    }

    if(diff.length)
      this.refresh(diff);

    return this;
  }

  function willThrowUpdateIsForbidden(key: string){
    return () => { throw new Error(`Cannot modify external prop '${key}'!`) }
  }

  return this;
}