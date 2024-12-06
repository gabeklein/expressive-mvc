import { Model, PARENT, STATE } from "./model";

/**
 * Update callback function.
 * 
 * @param key -
 *   - `string` - property which has updated.
 *   - `false` - a normal update has completed.
 *   - `true` - initial event; instance is ready.
 *   - `null` - terminal event; instance is expired.
 * @param source - Instance of Model for which update has occured.
 */
type OnUpdate<T extends Model = any> = 
  (this: T, key: unknown, source: T) => (() => void) | null | void;

type OnAccess<T extends Model = any, R = unknown> =
  (from: T, key: string | number, value: R) => unknown;

type Effect<T extends Model> = (this: T, proxy: T) =>
  ((update: boolean | null) => void) | Promise<void> | null | void;

type Event = number | string | null | boolean | symbol;

/** Placeholder event determines if model is initialized or not. */
const onReady = () => null;

const LISTENERS = new WeakMap<Model, Map<OnUpdate, Set<Event> | undefined>>();

/** Events pending for a given object. */
const PENDING = new WeakMap<Model, Set<Event>>();

/** Central event dispatch. Bunches all updates to occur at same time. */
const DISPATCH = new Set<() => void>();

const OBSERVER = new WeakMap<Model, OnAccess>();

function addListener<T extends Model>(subject: T, callback: OnUpdate<T>, select?: Event){
  let listeners = LISTENERS.get(subject)!;

  if(!listeners)
    LISTENERS.set(subject, listeners = new Map([[onReady, undefined]]));

  const filter = select === undefined ? undefined : new Set([select]);

  if(!listeners.has(onReady) && !filter)
    callback.call(subject, true, subject);

  listeners.set(callback, filter);

  return () => listeners.delete(callback);
}

function emit(source: Model, key: Event){
  const listeners = LISTENERS.get(source)!;
  const isActive = !listeners.has(onReady);

  if(key === true && isActive)
    return;

  let pending = PENDING.get(source);

  if(pending){
    pending.add(key);
    return;
  }

  PENDING.set(source, pending = new Set(isActive ? [key] : [true, key]));

  for(const key of pending)
    for(const [callback, filter] of listeners)
      if(!filter || filter.has(key)){
        const after = callback.call(source, key, source);

        if(after)
          enqueue(after);

        else if(after === null)
          listeners.delete(callback);
      }

  if(key === null)
    listeners.clear();
  
  PENDING.delete(source);
}

function enqueue(eventHandler: (() => void)){
  if(!DISPATCH.size)
    setTimeout(() => {
      DISPATCH.forEach(event => {
        try {
          event();
        }
        catch(err){
          console.error(err);
        }
      });
      DISPATCH.clear();
    }, 0);

  DISPATCH.add(eventHandler);
}

function createProxy<T extends Model>(from: T, observer: OnAccess<T>){
  const proxy = Object.create(from) as T;
  OBSERVER.set(proxy, observer);
  return proxy;
}

function watch(from: any, key: string | number, value?: any){
  const access = OBSERVER.get(from);
  return access ? access(from, key, value) : value;
}

/**
 * Create a side-effect which will update whenever values accessed change.
 * Callback is called immediately and if ever values are stale.
 * 
 * @param target - Instance of Model to observe.
 * @param callback - Function to invoke when values change.
 * @param requireValues - If `true` will throw if accessing a value which is `undefined`.
 */
function createEffect<T extends Model>(target: T, callback: Effect<Required<T>>, requireValues: true): () => void;
function createEffect<T extends Model>(target: T, callback: Effect<T>, requireValues?: boolean): () => void;
function createEffect<T extends Model>(target: T, callback: Effect<T>, requireValues?: boolean){
  const listeners = LISTENERS.get(target)!;

  let unset: ((update: boolean | null) => void) | undefined;
  let reset: (() => void) | null | undefined;

  function invoke(){
    let stale: boolean | undefined;

    const subscriber = createProxy(target, access);

    LISTENERS.set(subscriber, listeners);

    function onUpdate() {
      if (stale)
        return null;

      stale = true;

      if (reset && unset) {
        unset(true);
        unset = undefined;
      }

      return reset;
    }

    function access(from: Model, key: string | number, value: any) {
      if(value === undefined && requireValues)
        throw new Error(`${from}.${key} is required in this context.`);

      const listeners = LISTENERS.get(from)!;
      let listener = listeners.get(onUpdate);

      if(!listener)
        listeners.set(onUpdate, listener = new Set);

      listener.add(key);

      const nested = LISTENERS.get(value);

      if(nested)
        LISTENERS.set(
          value = createProxy(value, access),
          nested
        );

      return value;
    }

    try {
      const out = callback.call(subscriber, subscriber);

      unset = typeof out == "function" ? out : undefined;
      reset = out === null ? out : invoke;
    }
    catch(err){
      if(err instanceof Promise){
        reset = undefined;
        err.then(invoke);
      }
      else
        throw err;
    }
  }

  addListener(target, key => {
    if(key === true)
      invoke();

    else if(!reset)
      return reset;

    if(key === null && unset)
      unset(null);
  });

  return () => {
    if(unset)
      unset(false);

    reset = null;
  };
}

function fetch(subject: Model, property: string, required?: boolean){
  const state = STATE.get(subject)!;
  
  if(property in state || required === false){
    const value = state[property];

    if(value !== undefined || !required)
      return value;
  }

  const error = new Error(`${subject}.${property} is not yet available.`);
  const promise = new Promise<any>((resolve, reject) => {
    addListener(subject, key => {
      if(key === property){
        resolve(state[key]);
        return null;
      }

      if(key === null)
        reject(new Error(`${subject} is destroyed.`));
    });
  });

  throw Object.assign(promise, {
    toString: () => String(error),
    name: "Suspense",
    message: error.message,
    stack: error.stack
  });
}

/** Currently accumulating export. Stores real values of placeholder properties such as ref() or child models. */
let EXPORT: Map<any, any> | undefined;

function extract<T extends Model>(model: T): Model.State<T> {
  const values = {} as any;
  let isNotRecursive;

  if(!EXPORT){
    isNotRecursive = true;
    EXPORT = new Map([[model, values]]);
  }

  for(let [key, value] of model){
    if(EXPORT.has(value))
      value = EXPORT.get(value);
    else if(value && typeof value == "object" && "get" in value && typeof value.get === "function")
      EXPORT.set(value, value = value.get());

    values[key] = value;
  }

  if(isNotRecursive)
    EXPORT = undefined;

  return Object.freeze(values);
}

function update<T>(
  subject: Model,
  key: string | number | symbol,
  value: T,
  arg?: boolean | Model.Setter<T>){

  const state = STATE.get(subject)!;

  if(Object.isFrozen(state))
    throw new Error(`Tried to update ${String(key)} but ${subject} is destroyed.`);

  const previous = state[key] as T;

  if(typeof arg == "function"){
    const out = arg.call(subject, value, previous);

    if(out === false)
      return false;

    if(typeof out == "function")
      value = out();
  }

  if(value === previous)
    return;

  if(value instanceof Model && !PARENT.has(value)){
    PARENT.set(value, subject);
    emit(value, true);
  }

  state[key] = value;

  if(arg !== true)
    event(subject, key);

  return true;
}

function event(
  subject: Model,
  key: string | number | symbol,
  silent?: boolean){

  let pending = PENDING.get(subject);

  if(!pending){
    PENDING.set(subject, pending = new Set());

    // TODO: if non-silent event follows a silent one, it would not emit.
    if(!silent)
      enqueue(() => {
        emit(subject, false);
        PENDING.delete(subject)
      })
  }

  pending.add(key);

  if(!silent)
    emit(subject, key);
}

/** Random alphanumberic of length 6; always starts with a letter. */
function uid(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}

export {
  addListener,
  createEffect,
  createProxy,
  emit,
  OnUpdate,
  enqueue,
  watch,
  event,
  uid,
  update,
  extract,
  fetch
}