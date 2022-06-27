import { Controller } from '../../controller';
import { Subscriber } from '../../subscriber';
import { create, defineProperty } from '../../util';

const ANY = Symbol("any");

export function managedSet<K>(
  control: Controller,
  property: any,
  initial: Set<K>){

  const lastUpdate = new Set();
  const context = new WeakMap<Subscriber, Set<K>>();
  const assoc = new WeakMap<Set<K>, (key: any) => void>();

  let managed: Set<K>;
  let value: Set<K>;

  function reset(){
    lastUpdate.clear();
  }

  function emit(key: any){
    lastUpdate.add(key);
    control.update(property);
    control.waiting.add(reset);
  }

  function setValue(next: Set<K>, initial?: boolean){
    value = next;
    managed = create(next);
    control.state.set(property, next);

    if(!initial)
      emit(ANY);

    const watch = (key: any, on: Set<any>) => {
      const local = assoc.get(on);

      if(local)
        local(key);
    };

    managed.add = (k) => {
      emit(k);
      return value.add(k);
    };

    managed.delete = (k) => {
      emit(k);
      return value.delete(k);
    };

    managed.clear = () => {
      emit(ANY);
      value.clear();
    }

    managed.has = function(key){
      watch(key, this);
      return value.has(key);
    };

    managed.values = function(){
      watch(ANY, this);
      return value.values();
    }

    managed.keys = function(){
      watch(ANY, this);
      return value.keys();
    }

    managed.entries = function(){
      watch(ANY, this);
      return value.entries();
    }

    managed[Symbol.iterator] = function(){
      watch(ANY, this);
      return value[Symbol.iterator]();
    };

    defineProperty(managed, "size", {
      get(){
        watch(ANY, this);
        return value.size;
      }
    })
  }

  function getValue(local?: Subscriber){
    if(!local)
      return managed;

    if(context.has(local))
      return context.get(local)!;

    const proxy = Object.create(managed) as Set<K>;
    const using = new Set();

    context.set(local, proxy);
    assoc.set(proxy, (key) => {
      if(!local.active)
        using.add(key);
    })

    local.add(property, () => {
      if(using.has(ANY) || lastUpdate.has(ANY) && using.size)
        return true;

      for(const key of lastUpdate)
        if(using.has(key))
          return true;
    });

    return proxy;
  }

  setValue(initial, true);

  return {
    set: setValue,
    get: getValue
  }
}