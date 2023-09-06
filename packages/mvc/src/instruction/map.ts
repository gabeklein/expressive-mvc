import { event, watch } from "../control";
import { add } from "../model";

export function map<K, T>(
  iterable?: Iterable<readonly [K, T]>
): Managed<K, T> {
  return add(() => {
    const value = new Managed<K, T>(iterable);

    return {
      value,
      set: false
    }
  })
}

class Managed<K, T = boolean> extends Map<K, T> {
  constructor(iterable?: Iterable<readonly [K, T]>){
    super(iterable);
  }

  [Symbol.iterator](){
    watch(this);
    return super[Symbol.iterator]();
  }

  get size(){
    watch(this);
    return super.size;
  }

  get(key: K){
    return watch(this, key, super.get(key));
  }

  has(key: any){
    watch(this, key);
    return super.has(key)
  }

  delete(key: any){
    event(this, key);
    return super.delete(key);
  }

  clear(){
    event(this, undefined);
    super.clear();
  }

  keys(){
    watch(this);
    return super.keys();
  }

  values(){
    watch(this);
    return super.values();
  }

  entries(){
    watch(this);
    return super.entries();
  }

  forEach(
    callbackfn: (a: any, b: any, c: any) => any,
    thisArg: any){

    const acc = [] as any[];

    super.forEach((a, b, c) => {
      const result = callbackfn.call(thisArg, a, b, c);

      if(result !== undefined)
        acc.push(result);
    })

    watch(this);
    return acc;
  }
}