import { Controller } from '../../controller';
import { Subscriber } from '../../subscriber';
import { assign, create, defineProperty } from '../../util';
import { Instruction } from '../apply';

const ANY = Symbol("any");

function keyed<T extends Set<any> | Map<any, any>>(
  control: Controller,
  property: any,
  initial: T
): Instruction.Descriptor<T> {
  type K = typeof ANY | (
    T extends Set<infer U> ? U :
    T extends Map<infer U, any> ? U :
    never
  );
  const context = new Map<Subscriber, T>();
  const users = new Map<Subscriber, Set<K>>();
  const watched = new WeakMap<T, Set<K>>();
  const update = new Set<(key: K) => void>();
  const frozen = new Set<Subscriber>();

  let managed!: T;

  manage(initial);

  function reset(){
    frozen.clear();
  }

  function watch(on: any, key: K){
    const include = watched.get(on);

    if(include)
      include.add(key);
  }

  function emit(key: K){
    control.waiting.add(reset);
    control.update(property);
    update.forEach(notify => notify(key));
  }

  function manage(current: T){
    managed = create(current);
    context.clear();

    assign(managed,
      <T>{
        delete(key: K){
          emit(key);
          return current.delete(key);
        },
        clear(){
          emit(ANY);
          current.clear();
        },
        has(key: K){
          watch(this, key);
          return current.has(key);
        },
        keys(){
          watch(this, ANY);
          return current.keys();
        },
        values(){
          watch(this, ANY);
          return current.values();
        },
        entries(){
          watch(this, ANY);
          return current.entries();
        },
        [Symbol.iterator](){
          watch(this, ANY);
          return current[Symbol.iterator]();
        },
      },
      current instanceof Set
        ? <T>{
          add(key: K){
            current.add(key);
            emit(key);
            return this;
          }
        }
        : <T>{
          get(key: K){
            watch(this, ANY);
            return current.get(key);
          },
          set(key: K, value: any){
            current.set(key, value);
            emit(key);
            return this;
          }
        }
    )

    defineProperty(managed, "size", {
      get(){
        watch(this, ANY);
        return current.size;
      }
    })
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
      manage(next);
      emit(ANY);
    },
    destroy(){
      update.clear();
    }
  }
}

export { keyed };