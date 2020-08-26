import { Controller } from './controller';

export function define(target: {}, values: {}): void;
export function define(target: {}, key: string | symbol, value: any): void;
export function define(target: {}, kv: {} | string | symbol, v?: {}){
  if(typeof kv == "string" || typeof kv == "symbol")
    Object.defineProperty(target, kv, { value: v })
  else
    for(const [key, value] of Object.entries(kv))
      Object.defineProperty(target, key, { value });
}

export function defineOnAccess<T>(
  object: T, 
  property: string | symbol, 
  init: (this: T) => any){

  Object.defineProperty(object, property, { 
    configurable: true,
    get: function(){
      const value = init.call(this);
      Object.defineProperty(this, property, { value });
      return value;
    }
  });
}

export function collectGetters(
  source: any, except: string[] = []){

  const getters = {} as BunchOf<() => any>;

  do {
    source = Object.getPrototypeOf(source);
    const desc = Object.getOwnPropertyDescriptors(source);
    const entries = Object.entries(desc);

    for(const [key, item] of entries)
      if("get" in item && item.get && !getters[key] && except.indexOf(key) < 0)
        getters[key] = item.get
  }
  while(source.constructor !== Controller
     && source.constructor !== Object);

  return getters;
}

type Params<T> = T extends (... args: infer T) => any ? T : never;
type MessageVariable = string | number | boolean | null;

class Issue extends Error {
  warn = () => { console.warn(this.message) }
  throw = (): never => { throw this }
}

export function Issues
  <O extends BunchOf<(...args: MessageVariable[]) => string>>
  (register: O){
  
  const Library = {} as any;

  for(const name in register)
    Library[name] = () => 
      new Issue(register[name].apply(null, arguments as any));

  return Library as {
    readonly [P in keyof O]:
      (...args: Params<O[P]>) => Issue
  };
}