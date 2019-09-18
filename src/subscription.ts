import { Controller } from './controller';
import { BunchOf, UpdateTrigger } from './types';
import { SpyController } from 'subscriber';

const { 
  defineProperty: define, 
  getOwnPropertyDescriptor: describe, 
  assign,
  create
} = Object;

const { random } = Math;

const TOGGLEABLE = /^is[A-Z]/;

const NEW_SUB = "__init_subscription__";
const UNSUBSCRIBE = "__delete_subscription__";
const SUBSCRIBE = "__activate_subscription__";

interface PolySet<T> extends Array<T> {
  new<T>(): PolySet<T>;
  add(item: T): void;
  delete(item: T): void;
  clear(): void;
}

function PolySet<T>(){
  const content = [] as T[];

  define(content, "add", {
    value: (x: T) => {
      if(content.indexOf(x) < 0)
        content.push(x);
    }
  })

  define(content, "remove", {
    value: (x: T) => {
      const i = content.indexOf(x);
      if(i >= 0)
        content.splice(i, 1);
    }
  })

  define(content, "clear", {
    value: () => {
      content.splice(0, content.length);
    }
  })

  return content as PolySet<T>;
}

function Dispatch(this: Controller){
  const mutable = {} as any;
  const register = {} as BunchOf<PolySet<UpdateTrigger>>;

  const pending = PolySet<string>();
  let isPending = false;

  for(const key of Object.getOwnPropertyNames(this)){
    const d = describe(this, key)!;

    if(d.get || d.set || typeof d.value === "function" || key[0] === "_")
      continue;

    mutable[key] = d.value;
    register[key] = PolySet();

    define(this, key, {
      get: () => mutable[key],
      set: enqueue(key),
      enumerable: true,
      configurable: false
    })

    if(TOGGLEABLE.test(key) && typeof d.value == "boolean")
      define(this, key.replace(/is/, "toggle"), {
        value: setToggle(key)
      })
  }

  define(this, "hold", {
    get: () => isPending,
    set: to => isPending = to
  })

  define(this, "get", { value: this });
  define(this, "set", { value: this });

  define(this, NEW_SUB, { 
    value: (hook: UpdateTrigger) => 
      SpyController(this, hook, mutable, register)
  })

  define(this, "refresh", { 
    value: function refreshSubscribersOf(...watching: string[]){
      for(const x of watching)
        pending.add(x)
      refresh();
    }
  });

  define(this, "export", {
    value: function exportCurrentValues(){
      const acc = {} as BunchOf<any>;
      for(const key in this){
          const { value } = describe(this, key)!;
          if(value)
            acc[key] = value;
      }
      return assign(acc, mutable);
    }
  })

  function refresh(){
    if(isPending)
        return;
    isPending = true;
    setTimeout(dispatch, 0)
  }

  function setToggle(key: string){
    return function toggle(to?: boolean){
      mutable[key] = !mutable[key]
      pending.add(key);
      refresh();
    }
  }

  function enqueue(to: string){
    return (value: any) => {
      if(mutable[to] === value) 
          return;

      mutable[to] = value;
      pending.add(to);

      refresh();
    }
  }

  function dispatch(){
    const inform = PolySet<UpdateTrigger>();
    for(const key of pending)
      for(const sub of register[key] || [])
        inform.add(sub);

    for(const refresh of inform)
      refresh(random());

    pending.clear();
    isPending = false;
  }
}

function SpyController(
  source: Controller, 
  hook: UpdateTrigger,
  mutable: BunchOf<any>,
  register: BunchOf<PolySet<UpdateTrigger>>
): SpyController {

  const Spy = create(source) as any;
  let watch = PolySet<string>();
  let exclude: PolySet<string>;

  for(const key in mutable)
    define(Spy, key, {
      set: describe(source, key)!.set,
      get: () => {
        watch.add(key);
        return mutable[key];
      }
    })

  define(Spy, SUBSCRIBE, { value: sub });
  define(Spy, UNSUBSCRIBE, { value: unSub });
  define(Spy, "once", { value: () => source });
  define(Spy, "on", { value: also });
  define(Spy, "only", { value: bail });
  define(Spy, "not", { value: except });

  return Spy;

  function sub(){
    if(exclude)
    for(const k of exclude)
      watch.delete(k);

    for(const key of watch){
      let set = register[key];
      if(!set)
        set = register[key] = PolySet();
      set.add(hook);
    }
  }

  function unSub(){
    for(const key of watch)
      register[key].delete(hook);
  }

  function bail(...keys: string[]){
    const watch = PolySet<string>();
    for(let arg of keys)
      for(const key of arg.split(","))
        watch.add(key);
    for(const key of watch)
      register[key].add(hook);
    return source;
  }

  function except(...keys: string[]){
    exclude = PolySet<string>();
    for(let arg of keys)
      for(const key of arg.split(","))
        exclude.add(key);
    return Spy;
  }

  function also(...keys: string[]){
    for(let arg of keys)
      for(const key of arg.split(","))
      watch.add(key);
    return Spy;
  }
}

export { Dispatch, SUBSCRIBE, UNSUBSCRIBE, NEW_SUB }