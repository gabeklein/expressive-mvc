import { Controller } from '../controller';
import { Subscriber } from '../subscriber';
import { assign, create, defineProperty } from '../util';
import { Instruction } from './apply';

type MapFunction<T, R> =
  T extends Map<infer K, infer V> ?
    (value: V, key: K, map: T) => R | void :
  T extends Set<infer K> ?
    (value: K, key: K, set: T) => R | void :
  never;

type Managed<T> = Exclude<T, "forEach"> & {
  from?: T;

  forEach<R>(
    mapFunction: MapFunction<T, R>,
    thisArg?: any
  ): Exclude<R, undefined>[] | void;
}

const ANY = Symbol("any");

type Keyed<K = unknown> = Set<K> | Map<K, unknown>;

function keyed<T extends Keyed>(
  control: Controller,
  property: any,
  initial: T
): Instruction.Descriptor<T> {
  type K = typeof ANY | (
    T extends Set<infer U> ? U :
    T extends Map<infer U, any> ? U :
    never
  );

  const init = createProxy(emit, watch);
  const frozen = new Set<Subscriber>();
  const context = new Map<Subscriber, T>();
  const users = new Map<Subscriber, Set<K>>();
  const watched = new WeakMap<T, Set<K>>();
  const update = new Set<(key: K) => void>();

  let managed: T = init(initial);

  function watch(on: any, key: K){
    const include = watched.get(on);

    if(include)
      include.add(key);
  }

  function emit(key: K){
    control.update(property);
    control.waiting.add(() => frozen.clear());
    update.forEach(notify => notify(key));
  }

  function subscribe(local: Subscriber){
    const proxy = create(managed);
    let watch = users.get(local);

    if(!watch){
      const using = watch = new Set<K>();
      users.set(local, using);
  
      function onEvent(key: K){
        if(frozen.has(local))
          return;
  
        if(key === ANY || using.has(key) || using.has(ANY)){
          const refresh = local.onUpdate(property, control);
  
          if(refresh){
            frozen.add(local);
            refresh()
          }
        }
      }
  
      local.add(property, false);
      local.dependant.add({
        commit(){
          if(using.size === 0)
            using.add(ANY);
  
          update.add(onEvent);
        },
        release(){
          update.delete(onEvent);
        }
      })
    }

    watched.set(proxy, watch);
    context.set(local, proxy);

    return proxy;
  }

  return {
    value: initial,
    get(local){
      return local ?
        context.get(local) || subscribe(local) :
        managed;
    },
    set(next){
      control.state.set(property, next);
      managed = init(next);
      context.clear();
      emit(ANY);
    },
    destroy(){
      update.clear();
      context.clear();
    }
  }
}

function createProxy(
  emit: (key: any) => void,
  watch: (self: any, key: any) => void){

  return <T extends Keyed<any>>(from: T) => {
    const proxy = create(from) as T;

    assign(proxy,
      {
        from,
        delete(key: any){
          emit(key);
          return from.delete(key);
        },
        clear(){
          emit(ANY);
          from.clear();
        },
        has(key: any){
          watch(this, key);
          return from.has(key);
        },
        keys(){
          watch(this, ANY);
          return from.keys();
        },
        values(){
          watch(this, ANY);
          return from.values();
        },
        entries(){
          watch(this, ANY);
          return from.entries();
        },
        forEach(
          callbackfn: (a: any, b: any, c: any) => any,
          thisArg: any){

          const acc = [] as any[];

          from.forEach((a, b, c) => {
            const result = callbackfn.call(thisArg, a, b, c);

            if(result !== undefined)
              acc.push(result);
          });

          watch(this, ANY);

          return acc;
        },
        [Symbol.iterator](){
          watch(this, ANY);
          return from[Symbol.iterator]();
        },
      },
      from instanceof Set
        ? {
          add(key: any){
            from.add(key);
            emit(key);
            return this;
          }
        }
        : {
          get(key: any){
            watch(this, ANY);
            return from.get(key);
          },
          set(key: any, value: any){
            from.set(key, value);
            emit(key);
            return this;
          }
        }
      )

      defineProperty(proxy, "size", {
        get(){
          watch(this, ANY);
          return from.size;
        }
      })
    
    return proxy;
  }
}

export { keyed, Managed };