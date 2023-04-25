import { getParent, getRecursive } from '../children';
import { Control, detect } from '../control';
import { issues } from '../helper/issues';
import { Model } from '../model';
import { add } from './add';

import type { Callback } from '../../types';

export const Oops = issues({
  PeerNotAllowed: (model, property) =>
    `Attempted to use an instruction result (probably use or get) as computed source for ${model}.${property}. This is not allowed.`,

  Failed: (parent, property, initial) =>
    `An exception was thrown while ${initial ? "initializing" : "refreshing"} ${parent}.${property}.`,

  Required: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}.`,
});

declare namespace get {
  type Function<T, S = any> = (this: S, on: S) => T;

  type Factory<R, T> = (this: T, property: string, on: T) => Function<R, T>;

  type FindFunction<T extends Model = Model> =
    (type: Model.Class<T>, relativeTo: Model, required: boolean) => Source<T>;

  type Source<T extends Model = Model> = (callback: (x: T) => void) => void;
}

/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Type - Type of controller compatible with this class. 
 * @param required - Throw if controller is created independantly.
 */
function get <T extends Model> (Type: Model.Type<T>, required?: true): T;
function get <T extends Model> (Type: Model.Type<T>, required: boolean): T | undefined;

function get <R, T extends Model> (Type: Model.Type<T>, compute: (this: T, on: T) => R): Exclude<R, undefined>;
function get <R, T extends Model> (Type: Model.Type<T>, compute: (this: T, on: T) => R): R;

/**
 * Implement a computed value; output will be generated by provided function.
 *
 * @param source - Source model from which computed value will be a subscriber.
 * @param compute - Compute function. Bound to a subscriber-proxy of source, returns output value. Will update automatically as input values change.
 */
function get <R, T> (source: T, compute: (this: T, on: T) => R): Exclude<R, undefined>;
function get <R, T> (source: T, compute: (this: T, on: T) => R): R;

/**
 * Implement a computed value; output is returned by function from provided factory.
 *
 * @param compute - Factory function to generate a getter to subscribe dependancies.
 */
function get <R, T> (compute: (property: string, on: T) => (this: T, state: T) => R): Exclude<R, undefined>;
function get <R, T> (compute: (property: string, on: T) => (this: T, state: T) => R): R;
 
function get<R, T extends Model>(
  arg0: get.Factory<R, T> | Model.Class<T> | T,
  arg1?: get.Function<R, T> | boolean): R {

  return add(
    function get(key){
      let { subject } = this;

      if(typeof arg0 == "symbol")
        throw Oops.PeerNotAllowed(subject, key);

      let source: get.Source = cb => cb(subject);

      if(arg0 instanceof Model)
        subject = arg0;

      else if(Model.isTypeof(arg0)){
        const parent = getParent(subject, arg0);

        if(parent)
          subject = parent;
        else
          source = arg0.has(arg1 !== false, subject);
      }

      else if(typeof arg0 == "function")
        arg1 = arg0.call(subject, key, subject);

      return typeof arg1 == "function"
        ? computed(this, key, source, arg1)
        : recursive(this, key, source, arg1);
    }
  )
}

function recursive(
  parent: Control,
  key: string,
  source: get.Source | undefined,
  required: boolean | undefined){

  const get = getRecursive(key, parent);
  let waiting: boolean;

  if(source)
    source((got) => {
      parent.state.set(key, got);

      if(waiting)
        parent.update(key);
    });

  waiting = true;

  return (source: Model) => {
    if(parent.state.get(key))
      return get(source);

    if(required !== false)
      parent.waitFor(key);
  }
}

function computed<T>(
  parent: Control,
  key: string,
  source: get.Source,
  setter: get.Function<T, any>){

  const { state } = parent;

  let proxy: any;
  let active: boolean;
  let isAsync: boolean;
  let reset: (() => void) | undefined;

  let order = ORDER.get(parent)!;
  let pending = KEYS.get(parent)!;

  if(!order)
    ORDER.set(parent, order = new Map());

  if(!pending)
    KEYS.set(parent, pending = new Set());

  INFO.set(compute, key);

  function compute(initial?: boolean){
    let next: T | undefined;

    try {
      next = setter.call(proxy, proxy);
    }
    catch(err){
      Oops.Failed(parent.subject, key, initial).warn();

      if(initial)
        throw err;
      
      console.error(err);
    }

    if(next !== state.get(key)){
      state.set(key, next);

      if(!initial || isAsync)
        parent.update(key);
    }
  }

  function connect(model: Model){
    if(reset)
      reset();

    let done: boolean;

    reset = () => done = true;

    proxy = detect(model, (_, control) => {
      if(done)
        return null;

      if(control !== parent)
        compute();
      else
        pending.add(compute);
    });

    try {
      compute(true);
    }
    finally {
      order.set(compute, order.size);
    }
  }

  return () => {
    if(!active){
      active = true;
      source(connect);
      isAsync = true;
    }
    
    if(!proxy)
      parent.waitFor(key);

    if(pending.delete(compute))
      compute();

    return state.get(key);
  }
}

const INFO = new WeakMap<Callback, string>();
const KEYS = new WeakMap<Control, Set<Callback>>();
const ORDER = new WeakMap<Control, Map<Callback, number>>();

function flushComputed(control: Control){
  const pending = KEYS.get(control);

  if(!pending || !pending.size)
    return;

  const priority = ORDER.get(control)!;

  while(pending.size){
    let compute!: Callback;

    for(const item of pending)
      if(!compute || priority.get(item)! < priority.get(compute)!)
        compute = item;

    pending.delete(compute);

    const key = INFO.get(compute)!;

    if(!control.frame.has(key))
      compute();
  }

  pending.clear();
}

export {
  flushComputed,
  get
}