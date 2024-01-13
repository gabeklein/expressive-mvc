import { Model, PARENT, uid } from './model';

const Register = new WeakMap<Model, Context | ((got: Context) => void)[]>();
const Table = new Map<symbol | Model.Type, symbol>();

function key(T: Model.Type | symbol, upstream?: boolean): symbol {
  let K = Table.get(T);

  if(!K)
    Table.set(T, K = Symbol(
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
  type Input = Record<string | number, Model | Model.Type<Model>>;
  type Expect<T = Model> = (model: T, upstream?: boolean) => (() => void) | void;
}

interface Context {
  [key: symbol]: Model | Set<Context.Expect> | null | undefined;
}

class Context {
  static get<T extends Model>(on: Model, callback: ((got: Context) => void)): void;
  static get<T extends Model>(on: Model): Context | undefined;
  static get(from: Model, callback?: (got: Context) => void){
    const waiting = Register.get(from);

    if(waiting instanceof Context){
      if(callback)
        callback(waiting);

      return waiting;
    }

    if(callback)
      if(waiting) 
        waiting.push(callback);
      else 
        Register.set(from, [callback]);
  }

  public id!: string;

  protected layer = new Map<string | number, Model | Model.Type>();
  protected cleanup = new Set<() => void>();

  constructor(inputs?: Context.Input){
    if(inputs)
      this.include(inputs);
  }

  public get<T extends Model>(Type: Model.Type<T>): T | undefined;
  public get<T extends Model>(Type: Model.Type<T>, callback: Context.Expect<T>): void;
  public get<T extends Model>(Type: Model.Type<T>, callback?: Context.Expect<T>){
    const result = this[key(Type)];

    if(result === null)
      throw new Error(`Did find ${Type} in context, but multiple were defined.`);

    if(callback){
      const K = key(Type, true);
      let callbacks = this.hasOwnProperty(K) && this[K] as Set<Context.Expect> | undefined;

      if(!callbacks)
        this[K] = callbacks = new Set();

      callbacks.add(callback as Context.Expect);
      callback(result as T);
    }

    return result as T | undefined;
  }

  public push(inputs?: Context.Input){
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

  public include(
    inputs: Context.Input,
    forEach?: (added: Model, explicit: boolean) => void
  ){
    const init = new Map<Model, boolean>();

    Object.entries(inputs).forEach(([K, V]) => {
      if(!(Model.is(V) || V instanceof Model))
        throw new Error(`Context can only include Model or instance but got ${V}${K && (" as " + K)}.`);
    })

    for(const key in inputs){
      const input = inputs[key];
      const exists = this.layer.get(key);

      if(!exists){
        const instance = this.add(input);

        this.layer.set(key, input)
        init.set(instance, true);
      }
      // Context must force-reset becasue inputs are no longer safe.
      else if(exists !== input){    
        this.pop();
        this.id = uid();
        this.include(inputs);
      }
    } 

    for(const [model, explicit] of init){
      model.set();

      if(forEach)
        forEach(model, explicit);
  
      for(const [_key, value] of model)
        if(PARENT.get(value as Model) === model){
          this.add(value as Model, true);
          init.set(value as Model, false);
        }
    }
  }

  protected add<T extends Model>(
    input: T | Model.Type<T>,
    implicit?: boolean){

    let T: Model.Type<T>;
    let I: T;

    if(typeof input == "function"){
      T = input;
      I = new input() as T;
      this.cleanup.add(() => I.set(null));
    }
    else {
      I = input;
      T = I.constructor as Model.Type<T>;
    }

    keys(T, true).forEach(K => {
      const result = this[K];
  
      if(result instanceof Set)
        result.forEach(cb => {
          const cleanup = cb(I, true);
        
          if(cleanup)
            this.cleanup.add(cleanup);
        });
    });

    keys(T).forEach(K => {
      const value = this.hasOwnProperty(K) ? null : I;

      if(value || this[K] !== I && !implicit)
        Object.defineProperty(this, K, {
          configurable: true,
          value
        });
    });

    const waiting = Register.get(I);
  
    if(waiting instanceof Array)
      waiting.forEach(cb => cb(this));

    Register.set(I, this);

    return I;
  }
}

export { Context }