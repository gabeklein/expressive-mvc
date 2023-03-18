import { getParent } from '../children';
import { Control, controller } from '../control';
import { issues } from '../helper/issues';
import { Callback } from '../helper/types';
import { Model } from '../model';
import { Subscriber } from '../subscriber';
import { add } from './add';

export const Oops = issues({
  PeerNotAllowed: (model, property) =>
    `Attempted to use an instruction result (probably use or get) as computed source for ${model}.${property}. This is not allowed.`,

  Failed: (parent, property, initial) =>
    `An exception was thrown while ${initial ? "initializing" : "refreshing"} [${parent}.${property}].`,

  Required: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,
});

declare namespace instruction {
  type Function<T, S = any> = (this: S, on: S) => T;

  type Factory<R, T> = (this: T, property: string, on: T) => Function<R, T>;

  type FindFunction<T extends Model = Model> =
    (type: Model.Type<T>, relativeTo: Model, required: boolean) => Source<T>;

  type Source<T extends Model = Model> =
    (_refresh: (x: T) => void) => T | undefined;

  /** Fetch algorithm for get instruction. */
  export let using: (fn: FindFunction) => typeof instruction;
}

/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Type - Type of controller compatible with this class. 
 * @param required - Throw if controller is created independantly.
 */
function instruction <T extends Model> (Type: Model.Type<T>, required?: true): T;
function instruction <T extends Model> (Type: Model.Type<T>, required: boolean): T | undefined;

function instruction <R, T extends Model> (Type: Model.Type<T>, compute: (this: T, on: T) => R): Exclude<R, undefined>;
function instruction <R, T extends Model> (Type: Model.Type<T>, compute: (this: T, on: T) => R): R;

/**
 * Implement a computed value; output will be generated by provided function.
 *
 * @param source - Source model from which computed value will be a subscriber.
 * @param compute - Compute function. Bound to a subscriber-proxy of source, returns output value. Will update automatically as input values change.
 */
function instruction <R, T> (source: T, compute: (this: T, on: T) => R): Exclude<R, undefined>;
function instruction <R, T> (source: T, compute: (this: T, on: T) => R): R;

/**
 * Implement a computed value; output is returned by function from provided factory.
 *
 * @param compute - Factory function to generate a getter to subscribe dependancies.
 */
function instruction <R, T> (compute: (property: string, on: T) => (this: T, state: T) => R): Exclude<R, undefined>;
function instruction <R, T> (compute: (property: string, on: T) => (this: T, state: T) => R): R;
 
function instruction<R, T extends Model>(
  this: instruction.FindFunction,
  arg0: instruction.Factory<R, T> | (Model.Type<T> & typeof Model) | T,
  arg1?: instruction.Function<R, T> | boolean): R {

  const fetch = this;

  return add(
    function get(key){
      let { subject } = this;

      if(typeof arg0 == "symbol")
        throw Oops.PeerNotAllowed(subject, key);

      let source: instruction.Source = () => subject;

      if(arg0 instanceof Model)
        subject = arg0;

      else if(Model.isTypeof(arg0))
        source = fetch(arg0, subject, arg1 !== false)!;

      else if(typeof arg0 == "function")
        arg1 = arg0.call(subject, key, subject);

      return typeof arg1 == "function"
        ? getComputed(key, this, source, arg1)
        : getRecursive(key, this, source, arg1);
    }
  )
}

function getParentForGetInstruction<T extends Model>(
  type: Model.Type<T>,
  relativeTo: Model,
  required: boolean
): instruction.Source {
  const item = getParent(relativeTo, type);

  return () => {
    if(item)
      return item;
    
    if(required)
      throw Oops.Required(type.name, relativeTo);
  };
}

function getRecursive(
  key: string,
  parent: Control,
  source: instruction.Source,
  required?: boolean){

  const context = new WeakMap<Subscriber, {} | undefined>();
  const { state } = parent;

  const value = source((got) => {
    state.set(key, got)
    parent.update(key);
  });

  // TODO: remove fixes suspense test
  if(value || required === false)
    state.set(key, value);

  const create = (local: Subscriber) => {
    let reset: Callback | undefined;

    local.follow(key, init);
    init();

    function init(){
      if(reset)
        reset();

      const value = state.get(key);

      if(value && controller(value)){
        const child = new Subscriber(value, local.onUpdate);

        if(local.active)
          child.commit();

        local.dependant.add(child);
        context.set(local, child.proxy);

        reset = () => {
          child.release();
          local.dependant.delete(child);
          context.set(local, undefined);
          reset = undefined;
        }
      }
    }
  }

  return (local: Subscriber | undefined) => {
    const value = state.get(key);

    if(!value && required !== false)
      parent.waitFor(key);

    if(!local)
      return value;

    if(!context.has(local))
      create(local);

    return context.get(local);
  }
}

function getComputed<T>(
  key: string,
  parent: Control,
  source: instruction.Source,
  setter: instruction.Function<T, any>){

  const { state } = parent;

  let local: Subscriber;
  let current: T | undefined;

  let order = ORDER.get(parent)!;
  let pending = KEYS.get(parent)!;

  if(!order)
    ORDER.set(parent, order = new Map());

  if(!pending)
    KEYS.set(parent, pending = new Set());

  const compute = (initial: boolean) => {
    try {
      current = undefined;
      current = setter.call(local.proxy, local.proxy);
    }
    catch(err){
      Oops.Failed(parent.subject, key, initial).warn();
      throw err;
    }
  }

  const refresh = () => {
    try {
      compute(false);
    }
    catch(e){
      console.error(e);
    }
    if(current !== state.get(key)){
      state.set(key, current);
      parent.update(key);
    }
  }

  const init = () => {
    // TODO: replace create with a cleanup function
    const got = source(init);

    if(!got)
      parent.waitFor(key);

    local = new Subscriber(got, (_, control) => {
      if(control !== parent)
        refresh();
      else
        pending.add(refresh);
    });

    local.watch.set(key, false);

    try {
      compute(true);
    }
    finally {
      local.commit();
      state.set(key, current);
      order.set(refresh, order.size);
    }
  }

  INFO.set(refresh, key);

  return () => {
    if(pending.delete(refresh))
      refresh();

    if(!local)
      init();

    return state.get(key);
  }
}

const INFO = new WeakMap<Callback, string>();
const KEYS = new WeakMap<Control, Set<Callback>>();
const ORDER = new WeakMap<Control, Map<Callback, number>>();

function flush(control: Control){
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

function using(fn: instruction.FindFunction){
  return Object.assign(instruction.bind(fn), { using, fn });
}

const get = using(getParentForGetInstruction);

export {
  flush,
  get
}