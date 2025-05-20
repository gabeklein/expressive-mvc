import { addListener } from './control';
import { event, Model, PARENT, uid } from './model';

const LOOKUP = new WeakMap<Model, Context | ((got: Context) => void)[]>();
const KEYS = new Map<symbol | Model.Type, symbol>();

function key(T: Model.Type | symbol, upstream?: boolean): symbol {
  let K = KEYS.get(T);

  if(!K)
    KEYS.set(T, K = Symbol(
      typeof T == "symbol" ? "get " + T.description : String(T)
    ));
  
  return upstream ? key(K) : K;
}

function keys(from: Model.Type, upstream?: boolean){
  const keys = new Set<symbol>();

  do {
    keys.add(key(from, upstream));
  }
  while((from = Object.getPrototypeOf(from)) !== Model);

  return keys;
}

declare namespace Context {
  type Multiple<T extends Model> = {
    [key: string | number]: Model.Init<T> | T;
  };

  type Accept<T extends Model = Model> = T | Model.Init<T> | Multiple<T>;

  type Expect<T extends Model = Model> = (model: T) => (() => void) | void;
}

interface Context {
  [key: symbol]: Model | Context.Expect | null | undefined;
}

class Context {
  static get<T extends Model>(on: Model, callback: ((got: Context) => void)): void;
  static get<T extends Model>(on: Model): Context | undefined;
  static get({ is }: Model, callback?: (got: Context) => void){
    const waiting = LOOKUP.get(is);

    if(waiting instanceof Context){
      if(callback)
        callback(waiting);

      return waiting;
    }

    if(callback)
      if(waiting) 
        waiting.push(callback);
      else 
        LOOKUP.set(is, [callback]);
  }

  public id!: string;

  protected layer = new Map<string | number, Model | Model.Type>();
  protected cleanup = new Set<() => void>();

  constructor(inputs?: Context.Accept){
    if(inputs)
      this.include(inputs);
  }

  /** Run callback when a specified type is registered to a **child** context. */
  public has<T extends Model>(Type: Model.Type<T>, callback: (model: T) => void){
    Object.defineProperty(this, key(Type, true), { value: callback, configurable: true });
  }

  /** Find specified type registered to a parent context. Returns undefined if none are found. */
  public get<T extends Model>(Type: Model.Type<T>, require: true): T;
  public get<T extends Model>(Type: Model.Type<T>, require?: boolean): T | undefined;
  public get<T extends Model>(Type: Model.Type<T>, require?: boolean){
    const result = this[key(Type)];

    if(result === null)
      throw new Error(`Did find ${Type} in context, but multiple were defined.`);

    if(result)
      return result as T;

    if(require)
      throw new Error(`Could not find ${Type} in context.`);
  }

  public push(inputs?: Context.Accept){
    const next = Object.create(this) as this;

    this.cleanup = new Set([() => next.pop(), ...this.cleanup]);

    next.layer = new Map();
    next.cleanup = new Set();

    if(inputs)
      next.include(inputs);

    return next;
  }

  public pop(){
    for(const key of Object.getOwnPropertySymbols(this))
      delete (this as any)[key];

    this.cleanup.forEach(cb => cb());
    this.cleanup.clear();
    this.layer.clear();
  }

  public include<T extends Model>(
    inputs: Context.Accept<T>,
    forEach?: Context.Expect<T>
  ){
    const init = new Map<Model, boolean>();

    if(typeof inputs == "function" || inputs instanceof Model)
      inputs = { 0: inputs };

    Object.entries(inputs).forEach(([K, V]: [string, Model | Model.Init<Model>]) => {
      if(Model.is(V) || V instanceof Model){
        const exists = this.layer.get(K);
  
        if(!exists){
          const instance = this.add(V);
  
          this.layer.set(K, V)
          init.set(instance, true);
        }
        // Context must force-reset because inputs are no longer safe.
        else if(exists !== V){    
          this.pop();
          this.id = uid();
          this.include(inputs);
        }

        return;
      }

      throw new Error(
        `Context may only include instance or class \`extends Model\` but got ${
          K == '0' || K == V ? V : `${V} (as '${K}')`
        }.`
      );
    })

    for(const [model, explicit] of init){
      model.set();

      if(explicit && forEach)
          forEach(model as T);

      for(const [_key, value] of model)
        if(PARENT.get(value as Model) === model){
          this.add(value as Model, true);
          init.set(value as Model, false);
        }
    }
  }

  protected add<T extends Model>(
    input: T | Model.Init<T>,
    implicit?: boolean){

    const cleanup = new Set<() => void>();
    let T: Model.Type<T>;
    let I: T;

    if(typeof input == "function"){
      T = input;
      I = new input() as T;
    }
    else {
      T = input.constructor as Model.Type<T>;
      I = input;
    }

    keys(T, true).forEach(K => {
      const expects = this[K] as Context.Expect | undefined;
  
      if(!expects)
        return;
  
      addListener(I, event => {
        if(event === true){
          const callback = expects(I);
            
          if(callback)
            cleanup.add(callback);
        }

        return null;
      })  
    });

    keys(T).forEach(K => {
      const value = this.hasOwnProperty(K) ? null : I;

      if(value || this[K] !== I && !implicit)
        Object.defineProperty(this, K, {
          configurable: true,
          value
        });
    });

    this.cleanup.add(() => {
      cleanup.forEach(cb => cb());

      if(I !== input)
        event(I, null);
    })

    const waiting = LOOKUP.get(I);
  
    if(waiting instanceof Array)
      waiting.forEach(cb => cb(this));

    LOOKUP.set(I, this);

    return I;
  }
}

export { Context }