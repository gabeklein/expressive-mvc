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

  public get<T extends Model>(Type: Model.Type<T>): T | undefined;
  public get<T extends Model>(Type: Model.Type<T>, callback: (model: T) => void): void;
  public get<T extends Model>(Type: Model.Type<T>, callback?: ((model: T) => void)){
    if(callback)
      define(this, key(Type, true), { value: callback });

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

    Object.entries(inputs).forEach(([K, V]: [string, unknown]) => {
      if(Model.is(V) || V instanceof Model)
        return;

      if(K && K != V)
        V = `${V} (as '${K}')`;

      throw new Error(
        `Context may only include instance or class \`extends Model\` but got ${V}.`
      );
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
      I = input;
      T = I.constructor as Model.Type<T>;
    }

    keys(T, true).forEach(K => {
      const result = this[K] as Context.Expect | undefined;
  
      if(!result)
        return;
  
      const callback = result(I);
        
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