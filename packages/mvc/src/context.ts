import { Model, PARENT, uid } from './model';

const Register = new WeakMap<Model, Context | ((got: Context) => void)[]>();
const Upstream = new WeakMap<Model | Model.Type, symbol>();
const Downstream = new WeakMap<Model | Model.Type, symbol>();

function key(T: Model.Type, upstream?: boolean){
  const table = upstream ? Upstream : Downstream;
  let key = table.get(T);

  if(!key){
    key = Symbol(T.name + (upstream ? " request" : ""));
    table.set(T, key);
  }

  return key;
}

declare namespace Context {
  type Input = Record<string | number, Model | Model.Type<Model>>;
  type Expect = (model: Model) => (() => void) | void;
}

class Context {
  static get<T extends Model>(on: Model, callback: ((got: Context) => void)): void;
  static get<T extends Model>(on: Model): Context | undefined;
  static get(from: Model, callback?: (got: Context) => void){
    const waiting = Register.get(from);

    if(!callback)
      return waiting instanceof Context ? waiting : undefined;
  
    if(waiting instanceof Context)
      callback(waiting);
    else if(waiting)
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
  public get<T extends Model>(Type: Model.Type<T>, callback: (model: T) => void): void;
  public get<T extends Model>(Type: Model.Type<T>, callback?: ((model: T) => void)){
    if(callback)
      return this.put(Type, callback);

    const result = this[key(Type) as keyof this];

    if(result === null)
      throw new Error(`Did find ${Type} in context, but multiple were defined.`);

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

    return Object.getPrototypeOf(this) as this;
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

    this.has(T, I);
    this.put(T, I, implicit);

    return I;
  }

  protected has<T extends Model>(type: Model.Type<T>, model: T){
    do {
      const K = key(type, true);
      const result = this[K as keyof this] as Context.Expect | undefined;
  
      if(!result)
        continue;
  
      const callback = result(model);
        
      if(callback)
        this.cleanup.add(callback);
    }
    while((type = Object.getPrototypeOf(type)) !== Model);

    const waiting = Register.get(model);
  
    if(waiting instanceof Array)
      waiting.forEach(cb => cb(this));

    Register.set(model, this);
  }

  protected put<T extends Model>(
    T: Model.Type<T>,
    I: T | ((model: T) => void),
    implicit?: boolean){

    do {
      const K = key(T, typeof I == "function");
      const value = this.hasOwnProperty(K) ? null : I;

      if(value || this[K as keyof this] !== I && !implicit)
        Object.defineProperty(this, K, { configurable: true, value });
    }
    while((T = Object.getPrototypeOf(T)) !== Model);
  }
}

export { Context }