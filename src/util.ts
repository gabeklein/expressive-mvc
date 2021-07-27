import { issues } from './issues';

export const Oops = issues({
  BadEffectCallback: () =>
    `Callback for effect-callback may only return a function.`
})

const {
  assign,
  create,
  defineProperty,
  entries,
  getPrototypeOf,
  getOwnPropertyNames,
  getOwnPropertyDescriptor,
  getOwnPropertyDescriptors,
  getOwnPropertySymbols,
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
  getOwnPropertyNames,
  getOwnPropertySymbols,
  keys,
  values
}

export function define(
  target: {}, key: string | symbol, value: any){

  defineProperty(target, key, { value })
}

export function defineLazy<T>(
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

export function setAlias<T extends Function>(
  func: T, displayName: string){

  assign(func, { displayName });
}

export function entriesIn(object: {}){
  return entries(getOwnPropertyDescriptors(object))
}

export function createEffect(
  callback: EffectCallback<any>){

  let unSet: Callback | Promise<any> | void;

  return (value: any, callee = value) => {
    typeof unSet == "function" && unSet();
    unSet = callback.call(callee, value);

    if(unSet instanceof Promise)
      unSet = undefined;

    if(unSet && typeof unSet !== "function")
      throw Oops.BadEffectCallback()
  }
}

export function name(instance: any){
  return instance.constructor.name;
}

export function selectRecursive(
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