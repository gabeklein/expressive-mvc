import { Controller } from '../../controller';
import { Subscriber } from '../../subscriber';
import { create, defineProperty } from '../../util';

const ANY = Symbol("any");

export function managedMap<K, V>(
  control: Controller,
  property: any,
  initial: Map<K, V>){

  const context = new WeakMap<Subscriber, Map<K, V>>();
  const lastUpdate = new Set();

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
  }

  function getValue(local?: Subscriber){
    if(!local)
      return managed;

    if(context.has(local))
      return context.get(local)!;

    const proxy = Object.create(managed) as Map<K, V>;
    const using = new Set();

    context.set(local, proxy);

    local.add(property, () => {
      if(using.has(ANY) || lastUpdate.has(ANY) && using.size)
        return true;

      for(const key of lastUpdate)
        if(using.has(key))
          return true;
    });

    const watch = (key: any) => {
      if(!local.active)
        using.add(key);
    };

    proxy.get = (key) => {
      watch(key);
      return value.get(key);
    };

    proxy.has = (key) => {
      watch(key);
      return value.has(key);
    };

    proxy.values = () => {
      watch(ANY);
      return value.values();
    }

    proxy.keys = () => {
      watch(ANY);
      return value.keys();
    }

    proxy.entries = () => {
      watch(ANY);
      return value.entries();
    }

    proxy[Symbol.iterator] = () => {
      watch(ANY);
      return value[Symbol.iterator]();
    };

    defineProperty(proxy, "size", {
      get(){
        watch(ANY);
        return value.size;
      }
    })

    return proxy;
  }

  setValue(initial, true);

  return {
    set: setValue,
    get: getValue
  }
}