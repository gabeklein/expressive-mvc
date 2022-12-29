import { Model } from '../model';
import { create, defineProperty, getOwnPropertyDescriptor, getOwnPropertySymbols, getPrototypeOf } from '../util';

export type Collection =
  | Array<Model | typeof Model>
  | { [anything: string]: Model | typeof Model };

export class Lookup {
  private table = new Map<typeof Model, symbol>();

  public get local(){
    return [
      ...new Set(getOwnPropertySymbols(this).map(
        symbol => (this as any)[symbol] as Model
      ))
    ]
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

  public push(){
    return create(this) as this;
  }

  public inject(
    T: typeof Model,
    I: Model,
    writable?: boolean){

    do {
      const key = this.key(T);
      const conflict = this.hasOwnProperty(key);

      defineProperty(this, key, {
        value: conflict ? null : I,
        configurable: true,
        writable
      });

      T = getPrototypeOf(T);
    }
    while(T !== Model);
  }

  public pop(){
    for(const key of getOwnPropertySymbols(this)){
      const entry = getOwnPropertyDescriptor(this, key)!;

      if(entry.writable && entry.value)
        entry.value.destroy();
    }
  }
}