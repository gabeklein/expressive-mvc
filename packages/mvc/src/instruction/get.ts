import { add, Control, parent, watch } from '../control';
import { Model } from '../model';
import { suspense } from '../suspense';

import type { Callback } from '../../types';

type Type<T extends Model> = Model.Type<T> & typeof Model;

declare namespace get {
  type Function<T, S = any> = (this: S, on: S) => T;

  type Factory<R, T> = (this: T, property: string, on: T) => Function<R, T>;

  type Source<T extends Model = Model> = (callback: (x: T) => void) => void;
}

/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Type - Type of controller compatible with this class. 
 * @param required - If true, will throw if Model is created without a parent.
 */
function get <T extends Model> (Type: Model.Type<T>, required?: true): T;

/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Type - Type of controller compatible with this class. 
 * @param required - If false, property may be undefined. Otherwise will throw suspense.
 */
function get <T extends Model> (Type: Model.Type<T>, required: boolean): T | undefined;

/**
 * Implement a computed value from a foreign model. Output will be generated by provided function,
 * where the foreign model will be passed to that function.
 * 
 * @param source - Type of Model to fetch for computation.
 * @param compute - Compute function. Will update automatically as input values change.
 */
function get <R, T extends Model> (Type: Model.Type<T>, compute: (this: T, on: T) => R): R;

/**
 * Implement a computed value; output will be generated by provided function.
 *
 * @param source - Source model from which computed value will be a subscriber.
 * @param compute - Compute function. Bound to a subscriber-proxy of source, returns output value. Will update automatically as input values change.
 */
function get <R, T extends Model> (source: T, compute: (this: T, on: T) => R): R;

/**
 * Implement a computed value; output is returned by function from provided factory.
 *
 * @param compute - Factory function to generate a getter to subscribe dependancies.
 */
function get <R, T> (compute: (property: string, on: T) => (this: T, state: T) => R): R;
 
function get<R, T extends Model>(
  arg0: T | get.Factory<R, T> | Type<T>,
  arg1?: get.Function<R, T> | boolean){

  return add((key, control) => {
    let { subject, state } = control;

    if(typeof arg0 == "symbol")
      throw new Error(`Attempted to use an instruction result (probably use or get) as computed source for ${subject}.${key}. This is not allowed.`)

    let source: get.Source = cb => cb(subject);

    if(arg0 instanceof Model)
      subject = arg0;

    else if(Model.is(arg0)){
      const hasParent = parent(subject);

      if(!hasParent){
        if(arg1 === true)
          throw new Error(`New ${subject} created standalone but requires parent of type ${arg0}.`)

        const fetch = Control.hooks.has(subject);

        source = got => {
          fetch(context => {
            const model = context.get(arg0);

            if(model)
              got(model);
            else if(arg1 !== false)
              throw new Error(`Attempted to find an instance of ${arg0} in context. It is required by ${subject}, but one could not be found.`)
          });
        }
      }
      else if(!arg0 || hasParent instanceof arg0)
        subject = hasParent;
      else
        throw new Error(`New ${subject} created as child of ${hasParent}, but must be instanceof ${arg0}.`);
    }

    else if(typeof arg0 == "function")
      arg1 = arg0.call(subject, key, subject);

    if(typeof arg1 == "function")
      return compute(control, key, source, arg1);

    source((got) => {
      control.update(key, got);
    });

    return () => {
      const value = state[key];

      if(value)
        return value;

      if(arg1 !== false)
        throw suspense(control, key);
    }
  })
}

const ORDER = new WeakMap<Callback, number>();
const PENDING = new Set<Callback>();

let OFFSET = 0;

function compute<T>(
  parent: Control,
  key: string,
  source: get.Source,
  setter: get.Function<T, any>){

  const { state, subject } = parent;

  let proxy: any;
  let active: boolean;
  let isAsync: boolean;
  let reset: (() => void) | undefined;

  function compute(initial?: boolean){
    if(key in parent.frame)
      return;

    let next: T | undefined;

    try {
      next = setter.call(proxy, proxy);
    }
    catch(err){
      console.warn(`An exception was thrown while ${initial ? "initializing" : "refreshing"} ${subject}.${key}.`)

      if(initial)
        throw err;
      
      console.error(err);
    }

    if(next !== state[key]){
      state[key] = next;

      if(!initial || isAsync)
        parent.update(key);
    }
  }

  function connect(model: Model){
    if(reset)
      reset();

    let done: boolean;

    reset = () => done = true;

    proxy = watch(model, (_, control) => {
      if(done)
        return null;

      if(control !== parent)
        compute();
      else
        PENDING.add(compute);
    });

    try {
      compute(true);
    }
    finally {
      ORDER.set(compute, OFFSET++);
    }
  }

  return () => {
    if(!active){
      active = true;
      source(connect);
      isAsync = true;
    }
    
    if(!proxy)
      throw suspense(parent, key);

    if(PENDING.delete(compute))
      compute();

    return state[key];
  }
}

Control.on("update", () => {
  while(PENDING.size){
    let compute!: Callback;

    for(const item of PENDING)
      if(!compute || ORDER.get(item)! < ORDER.get(compute)!)
        compute = item;

    PENDING.delete(compute);
    
    compute();
  }
});

export { get };