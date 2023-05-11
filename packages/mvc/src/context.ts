import { control, parent, uid } from './control';
import { issues } from './helper/issues';
import { create, defineProperty, getOwnPropertyDescriptor, getOwnPropertySymbols, getPrototypeOf } from './helper/object';
import { Model } from './model';

export const Oops = issues({
  MultipleExist: (name) =>
    `Did find ${name} in context, but multiple were defined.`,

  NewValue: (name) =>
    `Provider already has already defined '${name}' but it now differs. This is not yet supported.`
})

declare namespace Context {
  type Inputs = {
    [key: string | number]: Model | Model.New
  }
}

class Context {
  /** Use  */
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
      throw Oops.MultipleExist(Type);

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
      else if(exists !== input)
        return this.bailout(inputs);
    }

    for(const [ model ] of init){
      const { state } = control(model, true);
  
      Object.values(state).forEach(value => {
        if(parent(value) === model){
          this.add(value, true);
          init.set(value, false);
        }
      });
    }

    return init;
  }

  /** Context must force-reset becasue inputs are no longer safe. */
  private bailout(inputs: Context.Inputs){
    this.pop();
    this.key = uid();
    return this.include(inputs);
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
      I = input.is;
      T = I.constructor as Model.New<T>;
      writable = false;
    }

    do {
      const key = this.has(T);
      const value = this.hasOwnProperty(key) ? null : I;

      if(value || I !== this[key] && !implicit)
        defineProperty(this, key, {
          configurable: true,
          value,
          writable
        });

      T = getPrototypeOf(T);
    }
    while(T !== Model);

    return I;
  }

  public push(){
    const next = create(this) as this;
    next.layer = new Map();
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

    this.layer.clear();
  }
}

export { Context }