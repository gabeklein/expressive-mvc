import { Model } from './model';
import { create, defineProperty, getOwnPropertyDescriptor, getOwnPropertySymbols, values } from './util';

export type Collection =
  | Array<Model | typeof Model>
  | BunchOf<Model | typeof Model>;

export class Lookup {
  private table = new Map<typeof Model, symbol>();

  public get local(){
    return getOwnPropertySymbols(this).map(
      (symbol): Model => (this as any)[symbol]
    ) 
  }

  private key(T: typeof Model){
    let key = this.table.get(T);

    if(!key){
      key = Symbol(T.name);
      this.table.set(T, key);
    }

    return key;
  }

  public get(T: typeof Model){
    return (this as any)[this.key(T)];
  }
  
  public push(I: Model | typeof Model | Collection){
    const next = create(this) as this;

    if(I instanceof Model || typeof I == "function")
      next.register(I);
    else
      for(const i of values(I))
        next.register(i);

    return next;
  }

  public register(I: Model | typeof Model){
    let writable = true;
    let T: typeof Model;

    if(I instanceof Model){
      T = I.constructor as any;
      writable = false;
    }
    else {
      T = I;
      I = I.create();
    }

    do {
      defineProperty(this, this.key(T), {
        value: I,
        writable
      });
    }
    while(T = T.inherits!);

    return I;
  }

  public pop(){
    for(const key of getOwnPropertySymbols(this)){
      const entry = getOwnPropertyDescriptor(this, key)!;

      if(entry.writable)
        entry.value.destroy();
    }
  }
}