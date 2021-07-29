import { Model } from './model';
import { create, defineProperty, getOwnPropertyDescriptor, getOwnPropertySymbols, values } from './util';

export type Collection =
  | Array<Model | typeof Model>
  | BunchOf<Model | typeof Model>;

export class Lookup {
  private table = new Map<typeof Model, symbol>();
  public default?: Model;

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
  
  public push(insert: typeof Model | Model | Collection){
    const next = create(this) as Lookup;

    if(insert instanceof Model || typeof insert == "function")
      this.default = next.register(insert);
    else
      for(let I of values(insert))
        next.register(I);

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
      const { writable, value: instance } =
        getOwnPropertyDescriptor(this, key)!;

      if(writable)
        instance.destroy();
    }
  }
}