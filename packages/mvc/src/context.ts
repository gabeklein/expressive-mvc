import { control, parent } from './control';
import { issues } from './helper/issues';
import { create, defineProperty, getOwnPropertyDescriptor, getOwnPropertySymbols, getPrototypeOf } from './helper/object';
import { Model } from './model';

export const Oops = issues({
  MultipleExist: (name) =>
    `Did find ${name} in context, but multiple were defined.`
})

declare namespace Context {
  type Inputs = {
    [key: string | number]: Model | Model.New
  }
}

class Context {
  private table = new WeakMap<Model.Type, symbol>();
  private input = new Map<string | number, Model | Model.Type>();

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
      throw Oops.MultipleExist(Type);

    return result;
  }

  public include(inputs: Context.Inputs, assign?: {}){
    const init = new Set<Model>();

    for(const key in inputs){
      const input = inputs[key];

      if(key)
        if(this.input.get(key) === input)
          continue;
        else
          this.input.set(key, input);

      const instance = this.add(input);

      if(assign)
        for(const K in assign)
          if(K in instance)
            (instance as any)[K] = (assign as any)[K];
      
      init.add(instance);
    }

    for(const model of init){
      const { state } = control(model, true);
  
      Object.values(state).forEach(value => {
        if(parent(value) === model){
          this.add(value);
          init.add(value);
        }
      });
    }

    return init;
  }

  public add<T extends Model>(input: T | Model.New<T>){
    let writable = true;
    let T: Model.New<T>;
    let I: T;

    if(typeof input == "function"){
      T = input;
      I = new input();
    }
    else {
      I = input.is;
      T = I.constructor as Model.New<T>;
      writable = false;
    }

    do {
      const key = this.has(T);

      defineProperty(this, key, {
        configurable: true,
        value: this.hasOwnProperty(key) && I !== this[key] ? null : I,
        writable
      });

      T = getPrototypeOf(T);
    }
    while(T !== Model);

    return I;
  }

  public push(){
    const next = create(this) as this;
    next.input = new Map();
    return next;
  }

  public pop(){
    const items = new Set<Model>();

    for(const key of getOwnPropertySymbols(this)){
      const entry = getOwnPropertyDescriptor(this, key)!;

      if(entry.writable && entry.value)
        items.add(entry.value);

      delete (this as any)[key];
    }

    for(const model of items)
      model.null();

    this.input.clear();
  }
}

export { Context }