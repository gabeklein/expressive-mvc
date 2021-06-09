import Oops from './issues';

const {
  assign,
  create,
  defineProperty,
  entries,
  getPrototypeOf,
  getOwnPropertyDescriptor,
  getOwnPropertyDescriptors,
  keys,
  values
} = Object;

export {
  assign,
  create,
  defineProperty,
  entries,
  getPrototypeOf,
  getOwnPropertyDescriptor,
  insertAfter,
  keys,
  values
}

export {
  alias,
  createEffect,
  debounce,
  define,
  defineLazy,
  entriesIn,
  fn,
  recursiveSelect
}

function define(
  target: {}, key: string | symbol, value: any){

  defineProperty(target, key, { value })
}

function defineLazy<T>(
  object: T, 
  property: string | symbol, 
  init: (this: T) => any){

  defineProperty(object, property, { 
    configurable: true,
    get(){
      const value = init!.call(this);
      defineProperty(this, property, { value });
      return value;
    }
  });
}

function fn(x: any): x is Function {
  return typeof x == "function";
}

function alias<T extends Function>(
  fn: T, displayName: string): T {

  return assign(fn, { displayName });
}

function entriesIn(
  object: {}): [string, PropertyDescriptor][] {

  return entries(getOwnPropertyDescriptors(object))
}

function debounce(callback: Callback){
  let throttle: undefined | boolean;

  return () => {
    if(!throttle){
      throttle = true;
      callback();
      setTimeout(() => {
        throttle = false;
      }, 0)
    }
  }
}

function createEffect(
  callback: EffectCallback<any>){

  let unSet: Callback | Promise<any> | void;

  return (value: any, callee = value) => {
    typeof unSet == "function" && unSet();
    unSet = callback.call(callee, value);

    if(unSet instanceof Promise)
      unSet = undefined;

    if(unSet && !fn(unSet))
      throw Oops.BadEffectCallback()
  }
}

function recursiveSelect(
  using: Function,
  keys: Iterable<string>){

  const found = new Set<string>();
  const spy = {} as Recursive<any>;

  for(const key of new Set(keys))
    defineProperty(spy, key, {
      get(){
        found.add(key);
        return spy;
      }
    });

  using(spy);

  return Array.from(found);
}

function insertAfter<T>(
  into: T[],
  item: T,
  predicate: (item: T) => boolean){

  const matchIndex = into.findIndex(predicate);
  into.splice(matchIndex + 1, 0, item);
}