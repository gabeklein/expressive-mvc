import { Controller } from './controller';
import { Set } from './polyfill';
import { SUBSCRIBE, createSubscription } from './subscriber';
import { BunchOf, ModelController, SpyController, UpdateTrigger } from './types';

declare const setTimeout: (callback: () => void, ms: number) => number;
export type UpdateEventHandler = (value: any, key: string) => void;
export type UpdatesEventHandler = (observed: {}, updated: string[]) => void;

export const DISPATCH = "__subscription_dispatch__";
export const SOURCE = "__subscription_source__";

const { 
  defineProperty: define,
  getOwnPropertyDescriptor: describe,
  getOwnPropertyDescriptors: describeAll,
  getOwnPropertyNames: keysOf,
  getPrototypeOf: prototypeOf
} = Object;

const { random } = Math;

function gettersFor(prototype: any, ignore?: string[]){
  const getters = {} as any;

  do {
    prototype = Object.getPrototypeOf(prototype);

    const described = describeAll(prototype);
    
    for(const item in described){
      if(ignore && ignore.indexOf(item) >= 0)
        continue;

      if("get" in described[item] && !getters[item])
        getters[item] = described[item].get
    }
  }
  while(prototype !== Object.prototype 
     && prototype !== Controller.prototype);

  return getters as BunchOf<Function>
}

export function createDispatch(control: ModelController){
  if(DISPATCH in control)
    return

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

  const getters = gettersFor(control, ["Provider", "Input", "Value"]);

  define(control, SOURCE, { value: mutable })
  define(control, DISPATCH, { value: register })

  for(const key in getters)
    createComputed(key, getters[key]);

  define(control, "observe", { value: addUpdateListener })
  define(control, "export", { value: exportValues })
  define(control, "get", { value: control })
  define(control, "set", { value: control })
  define(control, "toggle", { value: toggle })
  define(control, "refresh", { value: refreshSubscribersOf })
  define(control, "hold", {
    get: () => isPending,
    set: to => isPending = to
  })

  /* closured subroutines */

  function exportValues(
    this: BunchOf<any>,
    subset?: string[] | (() => void), 
    onChange?: (() => void) | boolean,
    initial?: boolean){

    if(typeof subset == "function"){
      initial = onChange as boolean;
      onChange = subset;
      subset = Object.keys(mutable).filter(x => !x.match(/^_/));
    }

    if(typeof onChange == "function")
      return addValuesObserver(subset!, onChange, initial)
    else 
      return getValues.call(this, subset)
  }

  function addUpdateListener(
    watch: string | string[], 
    handler: UpdateEventHandler){

    const flush: Function[] = [];

    if(typeof watch == "string")
      watch = [watch];

    for(const key of watch){
      const listeners = register[key];
  
      if(!listeners)
        throw new Error(
          `Can't watch property ${key}, it's not tracked on this instance.`
        )
  
      const trigger = () => handler.call(control, mutable[key], key);
  
      listeners.add(trigger);
      flush.push(() => listeners.delete(trigger))
    }

    return () => flush.forEach(x => x());
  }

  function addValuesObserver(
    keys: string[], 
    observer: UpdatesEventHandler,
    fireInitial?: boolean){

    const flush: Function[] = [];
    const pending = new Set<string>();

    for(const key of keys){
      const listeners = register[key];
  
      if(!listeners)
        throw new Error(
          `Can't watch property ${key}, it's not tracked on this instance.`
        )

      const trigger = () => {
        if(!pending.length)
          setTimeout(dispatch, 0)
        pending.add(key);
      };

      listeners.add(trigger);
      flush.push(() => listeners.delete(trigger))
    }

    function dispatch(){
      const acc = {} as any;

      for(const k of keys)
        acc[k] = mutable[k];

      observer.call(control, acc, Array.from(pending))
      
      pending.clear();
    }

    if(fireInitial)
      dispatch()

    return () => flush.forEach(x => x());
  }

  function createComputed(key: string, fn: () => any){
    const recompute = () => {
      const value = fn.call(control);

      if(mutable[key] === value)
        return

      mutable[key] = value;
      pending.add(key);
      for(const sub of register[key] || [])
        sub(random());
    }

    register[key] = new Set();

    //TODO: why is this here?
    recompute.immediate = true;

    const spy: SpyController = createSubscription(control, recompute);

    mutable[key] = fn.call(spy);
    spy[SUBSCRIBE]();

    define(control, key, {
      set: () => { throw new Error(`Cannot set ${key} on this controller, it is computed.`) },
      get: () => fn.call(control),
      enumerable: true,
      configurable: true
    })
  }

  function toggle(key: string){
    const cast = control as any;
    return cast[key] = !cast[key]
  }

  function refreshSubscribersOf(...watching: string[]){
    for(const x of watching)
      pending.add(x)
      
    refresh();
  }

  function getValues(this: BunchOf<any>, subset?: string[]){
    const acc = {} as BunchOf<any>;

    if(subset){
      for(const key of subset){
        let desc = describe(this, key);

        acc[key] = 
          desc && 
          desc.value !== undefined && 
          desc.value || 
          mutable[key]
      }

      return acc;
    }

    for(const key in this){
      const desc = describe(this, key);

      if(!desc) continue;

      if(desc.value !== undefined)
        acc[key] = desc.value;
    }
    for(const key in mutable)
      acc[key] = mutable[key]

    return acc;
  }

  function refresh(){
    if(!isPending){
      isPending = true;
      setTimeout(dispatch, 0)
    }
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

export function integrateExternalValues(
  this: ModelController,
  external: BunchOf<any>){

  createDispatch(this);

  const mutable = this[SOURCE];
  const inner = prototypeOf(this);

  for(const key of keysOf(external)){
    mutable[key] = external[key];
    define(inner, key, {
      enumerable: true,
      get: () => mutable[key],
      set: () => {
        throw new Error(`Cannot modify external prop '${key}'!`)
      }
    })
  }

  define(inner, "watch", { value: updateExternalValues })

  return this;
}

function updateExternalValues(
  this: ModelController,
  external: BunchOf<any>){

  const mutable = this[SOURCE];
  let updated = [];

  for(const key of keysOf(external)){
    if(external[key] == mutable[key])
      continue;
    mutable[key] = external[key];
    updated.push(key);
  }

  if(updated.length)
    this.refresh(updated);

  return this;
}