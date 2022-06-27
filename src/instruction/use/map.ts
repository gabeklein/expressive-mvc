import { Controller } from '../../controller';
import { Subscriber } from '../../subscriber';
import { create, defineProperty } from '../../util';

const ANY = Symbol("any");

export function managedMap<K, V>(
  control: Controller,
  property: any,
  initial: Map<K, V>){

  const lastUpdate = new Set();
  const context = new WeakMap<Subscriber, Map<K, V>>();
  const assoc = new WeakMap<Map<K, V>, (key: any) => void>();

  let managed: Map<K, V>;
  let value: Map<K, V>;

  function reset(){
    lastUpdate.clear();
  }

  function emit(key: any){
    lastUpdate.add(key);
    control.update(property);
    control.waiting.add(reset);
  }

  function setValue(next: Map<K, V>, initial?: boolean){
    value = next;
    managed = create(next);
    control.state.set(property, next);

    if(!initial)
      emit(ANY);

    const watch = (key: any, on: Map<any, any>) => {
      const local = assoc.get(on);

      if(local)
        local(key);
    };

    managed.set = (k, v) => {
      emit(k);
      return value.set(k, v);
    };

    managed.delete = (k) => {
      emit(k);
      return value.delete(k);
    };

    managed.clear = () => {
      emit(ANY);
      value.clear();
    }

    managed.get = function(key){
      watch(key, this);
      return value.get(key);
    };

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

    const proxy = Object.create(managed) as Map<K, V>;
    const using = new Set();

    context.set(local, proxy);
    assoc.set(proxy, (key) => {
      if(!local.active)
        using.add(key);
    });

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