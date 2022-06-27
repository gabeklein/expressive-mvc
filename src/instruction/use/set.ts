import { Controller } from '../../controller';
import { Subscriber } from '../../subscriber';
import { create, defineProperty } from '../../util';

export function managedSet<K>(
  control: Controller,
  property: any,
  initial: Set<K>){

  const context = new WeakMap<Subscriber, Set<K>>();
  const lastUpdate = new Set();

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
      emit(true);

    managed.add = (k) => {
      emit(k);
      return value.add(k);
    };

    managed.delete = (k) => {
      emit(k);
      return value.delete(k);
    };

    managed.clear = () => {
      emit(true);
      value.clear();
    }
  }

  function getValue(local?: Subscriber){
    if(!local)
      return managed;

    if(context.has(local))
      return context.get(local)!;

    const proxy = Object.create(managed) as Set<K>;
    const using = new Set();

    context.set(local, proxy);

    local.add(property, () => {
      if(using.has(true) || lastUpdate.has(true) && using.size)
        return true;

      for(const key of lastUpdate)
        if(using.has(key))
          return true;
    });

    const watch = (key: any) => {
      if(!local.active)
        using.add(key);
    };

    proxy.has = (key) => {
      watch(key);
      return value.has(key);
    };

    proxy.values = () => {
      watch(true);
      return value.values();
    }

    proxy.keys = () => {
      watch(true);
      return value.keys();
    }

    proxy.entries = () => {
      watch(true);
      return value.entries();
    }

    proxy[Symbol.iterator] = () => {
      watch(true);
      return value[Symbol.iterator]();
    };

    defineProperty(proxy, "size", {
      get(){
        watch(true);
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