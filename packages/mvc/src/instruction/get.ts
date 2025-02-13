import { Context } from '../context';
import { createEffect } from '../control';
import { fetch, METHOD, Model, PARENT, event, update } from '../model';
import { use } from './use';

type Type<T extends Model> = Model.Type<T> & typeof Model;

const STALE = new WeakSet<() => void>();

declare namespace get {
  type Compute<T, S = any> = (on: S, key: string) => T;

  type Factory<T, S = any> = (this: S, key: string, thisArg: S) => T;

  type Source<T extends Model = Model> = (resolve: (x: T) => void) => void;

  type Effect<T> = (model: T, key: string) => (() => void) | void;
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
function get <R, T extends Model> (Type: Model.Type<T>, effect: get.Effect<T>): R;

/**
 * Implement a computed value; output will be generated by provided function.
 *
 * @param source - Source model from which computed value will be a subscriber.
 * @param compute - Compute function. Bound to a subscriber-proxy of source, returns output value. Will update automatically as input values change.
 */
function get <R, T extends Model> (source: T, compute: get.Compute<R, T>): R;

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
  arg1?: Function | boolean){

  return use((key, subject, state) => {
    if(typeof arg0 == "symbol")
      throw new Error(`Attempted to use an instruction result (probably use or get) as computed source for ${subject}.${key}. This is not allowed.`)

    if(Model.is(arg0)){
      const hasParent = PARENT.get(subject) as T;
      let cb: (() => void) | void;

      function assign(value: T) {
        if (typeof cb == "function")
          cb = void cb();

        if (typeof arg1 == "function")
          cb = value.get(x => (arg1 as Function)(x, key));

        update(subject, key, value);
      }

      if(!hasParent){
        if(arg1 === true)
          throw new Error(`${subject} may only exist as a child of type ${arg0}.`);

        Context.get(subject, (context) => {
          const model = context.get(arg0);

          if(model)
            assign(model);
          else if(arg1 !== false)
            throw new Error(`Required ${arg0} not found in context for ${subject}.`)
        });
      }
      else if(!arg0 || hasParent instanceof arg0)
        assign(hasParent);
      else
        throw new Error(`New ${subject} created as child of ${hasParent}, but must be instanceof ${arg0}.`);

      return { get: arg1 !== false };
    }
    
    const source: get.Source<T> = resolve => resolve(from);
    let from = subject;
    
    if(arg0 instanceof Model){
      from = arg0;
    }
    else {
      const fn = METHOD.get(arg0) || arg0;
      arg1 = ((p, k) => fn.call(p, k, p)) as get.Effect<T>;
    }

    if(typeof arg1 == "function"){
      const getter = arg1 as get.Compute<R, T>;
      let reset: (() => void) | undefined;
      let isAsync: boolean;
      let proxy: any;
  
      function connect(model: Model){
        reset = createEffect(model, current => {
          proxy = current;
  
          if(!(key in state) || STALE.delete(compute))
            compute(!reset);
  
          return (didUpdate) => {
            if(didUpdate){
              STALE.add(compute);
              event(subject, key, true);
            }
          };
        })
      }
  
      function compute(initial?: boolean){
        let next: R | undefined;
  
        try {
          next = getter.call(proxy, proxy, key);
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
    else 
      source(model => {
        update(subject, key, model)
      });

    return { get: arg1 };
  })
}

export { get };