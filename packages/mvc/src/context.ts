import { control, parent } from './control';
import { Model, uid } from './model';

declare namespace Context {
  type Inputs = {
    [key: string | number]: Model | Model.New
  }
}

class Context {
  static resolve(from: Model, callback: (context: Context) => void){
    throw new Error(`Using context requires an adapter. If you are only testing, define \`get.context\` to simulate one.`);
  }

  public key!: string;

  private table = new WeakMap<Model.Type, symbol>();
  private layer = new Map<string | number, Model | Model.Type>();

  private has(T: Model.Type){
    let key = this.table.get(T);

    if(!key){
      key = Symbol(T.name);
      this.table.set(T, key);
    }

    return key as keyof this;
  }

  public get<T extends Model>(Type: Model.Type<T>){
    const result = this[this.has(Type)] as T | undefined;

    if(result === null)
      throw new Error(`Did find ${Type} in context, but multiple were defined.`);

    return result;
  }

  public include(inputs: Context.Inputs): Map<Model, boolean> {
    const init = new Map<Model, boolean>();

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
        this.key = uid();
        return this.include(inputs);
      }
    }

    for(const [ model ] of init)
      Object.values(control(model, true).state).forEach(value => {
        if(parent(value) === model){
          this.add(value as Model, true);
          init.set(value as Model, false);
        }
      });

    return init;
  }

  public add<T extends Model>(
    input: T | Model.New<T>, implicit?: boolean){

    let writable = true;
    let T: Model.New<T>;
    let I: T;

    if(typeof input == "function"){
      T = input;
      I = new input();
    }
    else {
      I = input;
      T = I.constructor as Model.New<T>;
      writable = false;
    }

    do {
      const key = this.has(T);
      const value = this.hasOwnProperty(key) ? null : I;

      if(value || I !== this[key] && !implicit)
      Object.defineProperty(this, key, {
          configurable: true,
          value,
          writable
        });

      T = Object.getPrototypeOf(T);
    }
    while(T !== Model);

    return I;
  }

  public push(){
    const next = Object.create(this) as this;
    next.layer = new Map();
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
      model.null();

    this.layer.clear();
  }
}

export { Context }