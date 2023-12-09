import { Model, PARENT, uid } from './model';

const Expects = new WeakMap<Model, Map<Model.Type, (model: any) => (() => void) | void>>();

declare namespace Context {
  type Input = 
    | Model
    | Model.New<Model>
    | Record<string | number, Model | Model.New<Model>>
}

class Context {
  static get(from: Model, callback: (context: Context) => void): void
  static get(){
    throw new Error(`Using context requires an adapter. If you are only testing, define \`get.context\` to simulate one.`);
  }

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
    const key = this.key(model.constructor as Model.New, true);
    const result = this[key] as ((model: Model) => () => void) | undefined;

    if(typeof result == "function")
      return result(model);
  }

  public get<T extends Model>(Type: Model.Type<T>){
    const result = this[this.key(Type)] as T | undefined;

    if(result === null)
      throw new Error(`Did find ${Type} in context, but multiple were defined.`);

    return result;
  }

  public include(inputs: Context.Input): Map<Model, boolean> {
    const init = new Map<Model, boolean>();

    if(typeof inputs == "function" || inputs instanceof Model)
      inputs = { [0]: inputs };

    else if(!inputs)
      reject(inputs);

    Object.entries(inputs).forEach(([K, V]) => {
      if(!(Model.is(V) || V instanceof Model))
        reject(`${V} as ${K}`);
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
        return this.include(inputs);
      }
    }

    for(const [ model ] of init){      
      this.has(model);
  
      const expects = Expects.get(model);
    
      if(expects)
        for(let [T, callback] of expects)
          this.put(T as Model.New, callback);
  
      for(const [_key, value] of model)
        if(PARENT.get(value as Model) === model){
          this.add(value as Model, true);
          init.set(value as Model, false);
        }
    }

    return init;
  }

  public put<T extends Model>(
    T: Model.New<T>,
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
    input: T | Model.New<T>,
    implicit?: boolean){

    let writable = true;
    let T: Model.New<T>;
    let I: T;

    if(typeof input == "function"){
      T = input;
      I = input.new() as T;
    }
    else {
      I = input;
      T = I.constructor as Model.New<T>;
      writable = false;
    }

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

function reject(argument: any){
  throw new Error(`Context can only include Model or instance but got ${argument}.`);
}

export { Context, Expects }