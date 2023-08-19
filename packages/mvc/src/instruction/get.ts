import { Context } from '../context';
import { Control, parent, watch } from '../control';
import { add, Model } from '../model';

type Type<T extends Model> = Model.Type<T> & typeof Model;

declare namespace get {
  type Function<T, S = any> = (this: S, on: S) => T;

  type Factory<R, T> = (this: T, property: string, on: T) => Function<R, T>;

  type Source<T extends Model = Model> = (resolve: (x: T) => void) => void;

  /** Adapter function should be defined by your environment. */
  export function from(target: Model): (resolve: (got: Context) => void) => void
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
    let { subject } = control;

    if(typeof arg0 == "symbol")
      throw new Error(`Attempted to use an instruction result (probably use or get) as computed source for ${subject}.${key}. This is not allowed.`)

    let source: get.Source = resolve => resolve(subject);

    if(arg0 instanceof Model)
      subject = arg0;

    else if(Model.is(arg0)){
      const hasParent = parent(subject);

      if(!hasParent){
        if(arg1 === true)
          throw new Error(`${subject} may only exist as a child of type ${arg0}.`);

        source = (resolve) => {
          Context.resolve(subject, context => {
            const model = context.get(arg0);

            if(model)
              resolve(model);
            else if(arg1 !== false)
              throw new Error(`Required ${arg0} not found in context for ${subject}.`)
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

    source(got => {
      control.state[key] = got;
      control.update(key)
    });

    return control.fetch(key, arg1 !== false);
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
      // TODO: address possibility of loop
      if(err instanceof Promise)
        throw err.finally(compute)

      console.warn(`An exception was thrown while ${initial ? "initializing" : "refreshing"} ${subject}.${key}.`)

      if(initial)
        throw err;
      
      console.error(err);
    }

    if(next !== state[key]){
      if(key in state || isAsync)
        parent.update(key);

      state[key] = next;
    }
  }

  function connect(model: Model){
    let done: boolean;

    if(reset)
      reset();

    reset = () => done = true;

    proxy = watch(model, (_, updated) => {
      if(done)
        return null;

      if(updated == subject)
        PENDING.add(compute);
      else
        compute();
    });

    output.get = () => {      
      if(PENDING.delete(compute))
        compute();
  
      return state[key] as T;
    }

    try {
      compute(true);
    }
    finally {
      ORDER.set(compute, OFFSET++);
    }
  }

  const output = {
    get(): any {
      output.get = parent.fetch(key);
      source(connect);
      isAsync = true;
      return output.get();
    }
  }

  return output as Control.PropertyDescriptor;
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