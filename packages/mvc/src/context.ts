import { Model, PARENT, define, uid } from './model';

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

  type ForEach = (added: Model, explicit: boolean) => void;

  type Expect = (model: Model) => (() => void) | void;
}

interface Context {
  [key: symbol]: Model | Context.Expect | null | undefined;
}

class Context {
  static get<T extends Model>(on: Model, callback: ((got: Context) => void)): void;
  static get<T extends Model>(on: Model): Context | undefined;
  static get(from: Model, callback?: (got: Context) => void){
    const waiting = LOOKUP.get(from);

    if(waiting instanceof Context){
      if(callback)
        callback(waiting);

      return waiting;
    }

    if(callback)
      if(waiting) 
        waiting.push(callback);
      else 
        LOOKUP.set(from, [callback]);
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
    define(this, key(Type, true), { value: callback });
  }

  /** Find specified type registered to a parent context. Returns undefined if none are found. */
  public get<T extends Model>(Type: Model.Type<T>){
    const result = this[key(Type)];

    if(result === null)
      throw new Error(`Did find ${Type} in context, but multiple were defined.`);

    return result as T | undefined;
  }

  public push(inputs?: Context.Accept){
    const next = Object.create(this) as this;

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
    this.layer.clear();
  }

  public include<T extends Model>(
    inputs: Context.Accept<T>,
    forEach?: Context.ForEach | Model.Assign<T>
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

      const blame = K && K != String(V) ? `${V} (as '${K}')` : V;

      throw new Error(
        `Context may only include instance or class \`extends Model\` but got ${blame}.`
      );
    })

    for(const [model, explicit] of init){
      model.set();

      if(typeof forEach == "function")
        forEach(model, explicit);
      else if(forEach && explicit)
        model.set(forEach);

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

    let T: Model.Type<T>;
    let I: T;

    if(typeof input == "function"){
      Model.is(input);

      T = input;
      I = new input() as T;
      this.cleanup.add(() => I.set(null));
    }
    else {
      T = input.constructor as Model.Type<T>;
      I = input;
    }

    keys(T, true).forEach(K => {
      const expects = this[K] as Context.Expect | undefined;
  
      if(!expects)
        return;
  
      const callback = expects(I);
        
      if(callback)
        this.cleanup.add(callback);
    });

    keys(T).forEach(K => {
      const value = this.hasOwnProperty(K) ? null : I;

      if(value || this[K] !== I && !implicit)
        define(this, K, {
          configurable: true,
          value
        });
    });

    const waiting = LOOKUP.get(I);
  
    if(waiting instanceof Array)
      waiting.forEach(cb => cb(this));

    LOOKUP.set(I, this);

    return I;
  }
}

export { Context }