import { Controller } from './controller';
import { BunchOf } from './types';

const { 
  entries,
  defineProperty,
  getOwnPropertyDescriptors,
  getPrototypeOf
} = Object;

export class Set<T> extends Array<T> {
  add = (item: T) => {
    if(this.indexOf(item) < 0)
      this.push(item);
  };

  clear = () => {
    this.splice(0, this.length);
  };

  delete = (item: T) => {
    const i = this.indexOf(item);
    if(i >= 0)
      this.splice(i, 1);
  }

  get size(){
    return this.length;
  }
}

export class Map<K, V> extends Array<[K, V]> {
  get = (key: K) => {
    for(const [ _key, value ] of this)
      if(key === _key)
        return value as V;
  }

  set = (key: K, value: V) => {
    for(let i=0, l=this.length; i < l; i++)
      if(this[i][0] === key){
        this[i][1] = value;
        return;
      }
    
    this.push([key, value]);
    return;
  }
}

export function define(target: {}, values: {}): void;
export function define(target: {}, key: string | symbol, value: any): void;
export function define(target: {}, kv: {} | string | symbol, v?: {}){
  if(typeof kv == "string" || typeof kv == "symbol")
    defineProperty(target, kv, { value: v })
  else
    for(const [key, value] of entries(kv))
      defineProperty(target, key, { value });
}

export function callIfExists<T, A extends any[]>(
  fn?: (...args: A) => T, on?: any, args?: A){
    
  return fn && fn.apply(on, args as any)
}

export function dedent(t: TemplateStringsArray, ...v: any[]): string {
  const text = v.reduce((a, v, i) => a + v + t[i + 1], t[0]);
  const starting = /^\n( *)/.exec(text);
  
  if(starting){
    const indent = new RegExp("\n" + starting[1], "g");
    return text.replace(starting[0], "").replace(indent, "\n").replace(/\s*\n*$/, "")
  } 
  else return text;
}

export function defineOnAccess(
  object: any, property: string, init: () => any){

  Object.defineProperty(object, property, { 
    configurable: true,
    get: function(){
      const value = init.call(this);
      Object.defineProperty(this, property, { value });
      return value;
    }
  });
}

export function entriesOf(obj: {}){
  return entries(getOwnPropertyDescriptors(obj));
}

export function collectGetters(
  source: any, except: string[] = []){

  const getters = {} as BunchOf<() => any>;

  do {
    source = getPrototypeOf(source);
    for(const [key, item] of entriesOf(source))
      if("get" in item && item.get && !getters[key] && except.indexOf(key) < 0)
        getters[key] = item.get
  }
  while(source.constructor !== Controller
     && source.constructor !== Object);

  return getters;
}