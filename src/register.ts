import { Model } from './model';
import { create, defineProperty, getOwnPropertyDescriptor, getOwnPropertySymbols, values } from './util';

export type Collection =
  | Array<Model | typeof Model>
  | BunchOf<Model | typeof Model>;

export class Lookup {
  private table = new Map<typeof Model, symbol>();

  private key(T: typeof Model){
    let key = this.table.get(T);

    if(!key)
      this.table.set(T, 
        key = Symbol(T.name)
      );

    return key;
  }

  public get(T: typeof Model){
    return (this as any)[this.key(T)];
  }
  
  public push(items: Model | Collection){
    const next = create(this) as Lookup;

    items = items instanceof Model
      ? [ items ] : values(items);

    for(let I of items)
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