import { issues } from './helper/issues';
import { create, defineProperty, getOwnPropertyDescriptor, getOwnPropertySymbols, getPrototypeOf } from './helper/object';
import { Model } from './model';

export const Oops = issues({
  NotFound: (name) =>
    `Could not find ${name} in context.`,

  MultipleExist: (name) =>
    `Did find ${name} in context, but multiple were defined.`
})

export class Context {
  private table = new Map<Model.Type, symbol>();
  public register = new Map<string | number, Model | Model.Type>();

  private has(T: Model.Type){
    let key = this.table.get(T);

    if(!key){
      key = Symbol(T.name);
      this.table.set(T, key);
    }

    return key as keyof this;
  }

  public get<T extends Model>(Type: Model.Type<T>, required?: true): T;
  public get<T extends Model>(Type: Model.Type<T>, required?: boolean): T | undefined;
  public get<T extends Model>(Type: Model.Type<T>, required?: boolean){
    const result = this[this.has(Type)] as T | undefined;

    if(result === null)
      throw Oops.MultipleExist(Type);

    if(!result && required !== false)
      throw Oops.NotFound(Type);

    return result;
  }

  public add<T extends Model>(
    input: T | Model.New<T>,
    key?: number | string){

    if(key && this.register.get(key) === input)
      return typeof input == "object"
        ? input
        : this[this.has(input)] as T;

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
    
    if(key !== undefined)
      this.register.set(key, input);

    return I;
  }

  public push(){
    const next = create(this) as this;
    next.register = new Map();
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
      model.gc();
  }
}