import { event, watch } from '../control';
import { add } from './add';

export function map<K, T>(
  iterable?: Iterable<readonly [K, T]>
): Managed<K, T> {
  return add(() => {
    const source = new Map(iterable);
    const value = new Managed<K, T>(source);

    return {
      value,
      set: false
    }
  })
}

class Managed<K, T = boolean> {
  constructor(public is: Map<K, T>){}

  [Symbol.iterator](){
    watch(this);
    return this.is[Symbol.iterator]();
  }

  get size(){
    watch(this);
    return this.is.size;
  }

  add(this: Managed<K, boolean | unknown>, key: K){
    event(this, true);
    return this.is.set(key, true as T);
  }

  set(key: K, value: T): Map<K, T> {
    event(this, key);
    return this.is.set(key, value);
  }

  get(key: K){
    return watch(this, key, this.is.get(key));
  }

  has(key: any){
    watch(this, key);
    return this.is.has(key)
  }

  delete(key: any){
    event(this, key);
    return this.is.delete(key);
  }

  clear(){
    event(this, undefined);
    this.is.clear();
  }

  keys(){
    watch(this);
    return this.is.keys();
  }

  values(){
    watch(this);
    return this.is.values();
  }

  entries(){
    watch(this);
    return this.is.entries();
  }

  forEach(
    callbackfn: (a: any, b: any, c: any) => any,
    thisArg: any){

    const acc = [] as any[];

    this.is.forEach((a, b, c) => {
      const result = callbackfn.call(thisArg, a, b, c);

      if(result !== undefined)
        acc.push(result);
    })

    watch(this);
    return acc;
  }
}