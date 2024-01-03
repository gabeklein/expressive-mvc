import { Model, PARENT, uid } from './model';

const Register = new WeakMap<Model, Context | ((got: Context) => void)[]>();

declare namespace Context {
  type Input = Record<string | number, Model | Model.Type<Model>>
}

class Context {
  public id!: string;

  protected downstream = new WeakMap<Model.Type, symbol>();
  protected upstream = new WeakMap<Model.Type, symbol>();

  protected layer = new Map<string | number, Model | Model.Type>();

  constructor(inputs?: Context.Input){
    if(inputs)
      this.include(inputs);
  }

  public key(T: Model.Type, upstream?: boolean){
    const table = upstream ? this.upstream : this.downstream;
    let key = table.get(T);

    if(!key){
      key = Symbol(T.name + (upstream ? " request" : ""));
      table.set(T, key);
    }

    return key as keyof this;
  }

  public has(model: Model){
    const key = this.key(model.constructor as Model.Type, true);
    const result = this[key] as ((model: Model) => () => void) | undefined;
    const waiting = Register.get(model);
  
    if(waiting instanceof Array)
      waiting.forEach(cb => cb(this));

    Register.set(model, this);

    if(typeof result == "function")
      return result(model);
  }

  public get<T extends Model>(Type: Model.Type<T>){
    const result = this[this.key(Type)] as T | undefined;

    if(result === null)
      throw new Error(`Did find ${Type} in context, but multiple were defined.`);

    return result;
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

  public put<T extends Model>(
    T: Model.Type<T>,
    I: T | ((model: T) => void),
    implicit?: boolean,
    writable?: boolean){

    do {
      const key = this.key(T, typeof I == "function");
      const value = this.hasOwnProperty(key) ? null : I;

      if(value || this[key] !== I && !implicit)
        Object.defineProperty(this, key, {
          configurable: true,
          writable,
          value
        });

      T = Object.getPrototypeOf(T);
    }
    while(T !== Model);
  }

  public add<T extends Model>(
    input: T | Model.Type<T>,
    implicit?: boolean){

    let writable = true;
    let T: Model.Type<T>;
    let I: T;

    if(typeof input == "function"){
      T = input;
      I = new input() as T;
    }
    else {
      I = input;
      T = I.constructor as Model.Type<T>;
      writable = false;
    }

    this.has(I);
    this.put(T, I, implicit, writable);

    return I;
  }

  public push(inputs?: Context.Input){
    const next = Object.create(this) as this;
    next.layer = new Map();

    if(inputs)
      next.include(inputs);

    return next;
  }

  public pop(){
    const items = new Set<Model>();

    for(const key of Object.getOwnPropertySymbols(this)){
      const entry = Object.getOwnPropertyDescriptor(this, key)!;

      if(entry.writable && entry.value)
        items.add(entry.value);

      delete (this as any)[key];
    }

    for(const model of items)
      model.set(null);

    this.layer.clear();
  }
}

export { Context, Register }