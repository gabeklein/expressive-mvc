import { add } from "../control";

const ANY = Symbol("any");
const OBSERVER = new WeakMap<{}, () => void>();

function watch(on: any, key: any){
  // const include = watched.get(on);

  // if(include)
  //   include.add(key);
}

function emit(key: any){
  // control.update(property);
  // control.waiting.add(() => frozen.clear());
  // update.forEach(notify => notify(key));
}

function map<K, T>(
  iterable?: Iterable<readonly [K, T]> | null | undefined
){
  return add((key, control) => {
    const value = new Managed<K, T>();

    return { value }
  })
}

class Managed<K, T = boolean> extends Map<K, T> {
  [Symbol.iterator](){
    watch(this, ANY);
    return super[Symbol.iterator]();
  }

  get size(){
    watch(this, ANY);
    return super.size;
  }

  delete(key: any){
    emit(key);
    return super.delete(key);
  }

  clear(){
    emit(ANY);
    super.clear();
  }

  has(key: any){
    watch(this, key);
    return super.has(key);
  }

  keys(){
    watch(this, ANY);
    return super.keys();
  }

  values(){
    watch(this, ANY);
    return super.values();
  }

  entries(){
    watch(this, ANY);
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
    });

    watch(this, ANY);

    return acc;
  }
}