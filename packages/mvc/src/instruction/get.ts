import { effect } from '../control';
import { fetch, METHOD, Model, PARENT, push, update } from '../model';
import { add } from './add';

type Type<T extends Model> = Model.Type<T> & typeof Model;

declare namespace get {
  type Function<T, S = any> = (on: S, key: string) => T;

  type Factory<T, S = any> = (this: S, key: string, thisArg: S) => T;

  type Source<T extends Model = Model> = (resolve: (x: T) => void) => void;
}

/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Type - Type of controller compatible with this class. 
 * @param expectParent - If true, will throw if Model is created without a parent.
 */
function get <T extends Model> (Type: Model.Type<T>, asParent?: true): T;

/**
 * Fetches and assigns the controller which spawned this host.
 * When parent assigns an instance via `use()` directive, it
 * will be made available to child upon this request.
 *
 * @param Type - Type of controller compatible with this class. 
 * @param required - If false, property may be undefined. Otherwise will throw suspense.
 */
function get <T extends Model> (Type: Model.Type<T>, required?: false): T | undefined;

/**
 * Implement a computed value from a foreign model. Output will be generated by provided function,
 * where the foreign model will be passed to that function.
 * 
 * @param source - Type of Model to fetch for computation.
 * @param compute - Compute function. Will update automatically as input values change.
 */
function get <R, T extends Model> (Type: Model.Type<T>, compute: get.Function<R, T>): R;

/**
 * Implement a computed value; output will be generated by provided function.
 *
 * @param source - Source model from which computed value will be a subscriber.
 * @param compute - Compute function. Bound to a subscriber-proxy of source, returns output value. Will update automatically as input values change.
 */
function get <R, T extends Model> (source: T, compute: get.Function<R, T>): R;

/**
 * Implement a computed value; output is returned by function from provided factory.
 * 
 * Factory is bound to owner of property.
 *
 * @param compute - Factory function to generate a getter to subscribe dependancies.
 */
function get <R, T> (compute: get.Factory<R, T>): R;
 
function get<R, T extends Model>(
  arg0: T | get.Factory<R, T> | Type<T>,
  arg1?: get.Function<R, T> | boolean){

  return add<R>((key, subject) => {
    let from = subject;

    if(typeof arg0 == "symbol")
      throw new Error(`Attempted to use an instruction result (probably use or get) as computed source for ${from}.${key}. This is not allowed.`)

    let source: get.Source<T> = resolve => resolve(from);

    if(arg0 instanceof Model)
      from = arg0;

    else if(Model.is(arg0)){
      const hasParent = PARENT.get(from) as T;

      if(!hasParent){
        if(arg1 === true)
          throw new Error(`${from} may only exist as a child of type ${arg0}.`);

        source = (resolve) => {
          arg0.at(from, got => {
            if(got)
              resolve(got);
            else if(arg1 !== false)
              throw new Error(`Required ${arg0} not found in context for ${from}.`)
          })
        }
      }
      else if(!arg0 || hasParent instanceof arg0)
        from = hasParent;
      else
        throw new Error(`New ${from} created as child of ${hasParent}, but must be instanceof ${arg0}.`);
    }

    else if(typeof arg0 == "function"){
      const fn = METHOD.get(arg0) || arg0;
      arg1 = (p, k) => fn.call(p, k, p);
    }

    if(typeof arg1 == "function")
      return compute(subject, key, source, arg1);

    source((got) => subject.set(key, got));

    return { get: arg1 };
  })
}

const STALE = new WeakSet<() => void>();

function compute<T>(
  subject: Model,
  key: string,
  source: get.Source,
  setter: get.Function<T, any>){

  let reset: (() => void) | undefined;
  let isAsync: boolean;
  let proxy: any;

  function connect(model: Model){
    reset = effect(model, current => {
      proxy = current;

      if(!reset)
        compute(true);
      else if(STALE.delete(compute))
        compute();

      return (didUpdate) => {
        if(didUpdate){
          STALE.add(compute);
          push(subject, key, true);
        }
      };
    })
  }

  function compute(initial?: boolean){
    let next: T | undefined;

    try {
      next = setter.call(proxy, proxy, key);
    }
    catch(err){
      console.warn(`An exception was thrown while ${initial ? "initializing" : "refreshing"} ${subject}.${key}.`)

      if(initial)
        throw err;

      console.error(err);
    }

    update(subject, key, next, !isAsync);
  }

  return () => {
    if(!proxy){
      source(connect);
      isAsync = true;
    }

    if(STALE.delete(compute))
      compute();

    return fetch(subject, key, !proxy) as T;
  }
}

export { get };