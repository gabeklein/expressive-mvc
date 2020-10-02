const { defineProperty } = Object;

export function define(target: {}, values: {}): void;
export function define(target: {}, key: string | symbol, value: any): void;
export function define(target: {}, kv: {} | string | symbol, v?: {}){
  if(typeof kv == "string" || typeof kv == "symbol")
    defineProperty(target, kv, { value: v })
  else
    for(const [key, value] of Object.entries(kv))
      defineProperty(target, key, { value });
}

type DefineMultiple<T> = {
  [key: string]: (this: T) => any;
}

export const isFn = (x: any): x is Function => typeof x == "function";

export function entriesIn<T>(object: T){
  return Object.entries(
    Object.getOwnPropertyDescriptors(object)
  )
}

export function listAccess(
  available: string[],
  processor: (x: Recursive) => void){

  const found = new Set<string>();
  const spy = {} as Recursive;

  for(const key of available)
    defineProperty(spy, key, {
      get: () => (found.add(key), spy)
    });

  processor(spy);

  return Array.from(found);
}

export function assignSpecific(
  target: InstanceType<Class>,
  source: BunchOf<any>, 
  only?: string[]){

  const values = within(target);
  const proto = target.constructor.prototype;
  const select = only || Object.keys(source);
  const defer: string[] = [];

  for(const key of select){
    const descriptor = 
      Object.getOwnPropertyDescriptor(proto, key);

    if(descriptor && descriptor.set)
      defer.push(key)
    else
      values[key] = source[key];
  }

  for(const key of defer)
    values[key] = source[key];
}

export function defineAtNeed<T>(
  object: T, 
  property: string | symbol,
  init: (this: T) => any
): void;

export function defineAtNeed<T>(
  object: T, 
  property: DefineMultiple<T>
): void;

export function defineAtNeed<T>(
  object: T, 
  property: string | symbol | DefineMultiple<T>, 
  init?: (this: T) => any){

  if(typeof property === "object")
    for(const k in property)
      defineAtNeed(object, k, property[k]);
  else
    defineProperty(object, property, { 
      configurable: true,
      get: function(){
        const value = init!.call(this);
        defineProperty(this, property, { value });
        return value;
      }
    });
}

/**
 * Abstract "Type-Waiver" for controller.
 * Prevent compiler from complaining about arbitary property access.
 */
export function within<T>(controller: T): Any;
export function within<T>(controller: T, key: undefined): Any;
export function within<T>(controller: T, key?: string | symbol): any;
export function within<T, V>(controller: T, key: string | symbol, value: V): V;

export function within(
  source: any,
  key?: string | symbol,
  value?: any){

  if(value)
    return source[key!] = value;
  if(key)
    return source[key];
  else
    return source;
}

type Params<T> = T extends (... args: infer T) => any ? T : never;
type MessageVariable = string | number | boolean | null;

class Issue extends Error {
  constructor(message: string){
    super(message);
    this.stack = this.stack!.replace(/\n.+/, "");
  }

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