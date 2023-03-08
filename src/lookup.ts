import { create, defineProperty, getOwnPropertyDescriptor, getOwnPropertySymbols, getPrototypeOf } from './helper/object';
import { Model } from './model';

export class Lookup {
  private table = new Map<Model.Type, symbol>();
  public register!: Map<string | number, Model | Model.Type>;

  private key(T: Model.Type){
    let key = this.table.get(T);

    if(!key){
      key = Symbol(T.name);
      this.table.set(T, key);
    }

    return key as keyof this;
  }

  public get<T extends Model>(Type: Model.Type<T>){
    return this[this.key(Type)] as unknown as T | undefined;
  }

  public add(
    input: Model.New | Model,
    key?: number | string): Model {

    let writable = true;
    let T: Model.New;
    let I: Model;

    if(typeof input == "function"){
      T = input;
      I = new input();
    }
    else {
      I = input;
      T = I.constructor as Model.New;
      writable = false;
    }

    do {
      const key = this.key(T);

      defineProperty(this, key, {
        configurable: true,
        value: this.hasOwnProperty(key) ? null : I,
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

  public delete(instance: Model){
    for(const key of getOwnPropertySymbols(this)){
      const entry = getOwnPropertyDescriptor(this, key)!;

      if(entry.value === instance)
        delete (this as any)[key];
    }
  }

  public pop(){
    const items = new Set<Model>();

    for(const key of getOwnPropertySymbols(this)){
      const entry = getOwnPropertyDescriptor(this, key)!;

      if(entry.writable && entry.value)
        items.add(entry.value)
    }

    for(const model of items)
      model.end();
  }
}

export const Global = new Lookup();