import { Controller } from '../../controller';
import { Subscriber } from '../../subscriber';
import { create } from '../../util';

const ANY = Symbol("any");

export function managedSet<K>(
  control: Controller,
  property: any,
  initial: Set<K>){

  const managed = new ManagedSet(initial, emit);
  const context = new WeakMap<Subscriber, ManagedSet<K>>();
  const lastUpdate = new Set();

  function reset(){
    lastUpdate.clear();
  }

  function emit(key: any){
    lastUpdate.add(key);
    control.update(property);
    control.waiting.add(reset);
  }

  function setValue(next: Set<K>){
    managed.source = next;
    control.state.set(property, next);
    emit(ANY);
  }

  function getValue(local?: Subscriber){
    if(!local)
      return managed;

    if(context.has(local))
      return context.get(local)!;

    const refresh = local.onUpdate(property, control)!;
    const proxy = create(managed) as ManagedSet<K>;
    const using = new Set();

    const update = () => {
      if(using.has(ANY) || lastUpdate.has(ANY) && using.size)
        refresh();

      else for(const key of lastUpdate)
        if(using.has(key)){
          refresh();
          break;
        }
    }

    local.add(property, () => update);
    context.set(local, proxy);
    proxy.watch = (key) => {
      if(!local.active)
        using.add(key);
    }

    return proxy;
  }

  return {
    value: initial,
    set: setValue,
    get: getValue
  }
}

class ManagedSet<T> {
  constructor(
    public source: Set<T>,
    private emit: (key: T | typeof ANY) => void
  ){}

  watch(_key: T | typeof ANY){}

  add(key: T){
    this.emit(key);
    return this.source.add(key);
  };

  delete(key: T){
    this.emit(key);
    return this.source.delete(key);
  };

  clear(){
    this.emit(ANY);
    this.source.clear();
  }

  has(key: T){
    this.watch(key);
    return this.source.has(key);
  };

  values(){
    this.watch(ANY);
    return this.source.values();
  }

  keys(){
    this.watch(ANY);
    return this.source.keys();
  }

  entries(){
    this.watch(ANY);
    return this.source.entries();
  };

  [Symbol.iterator](){
    this.watch(ANY);
    return this.source[Symbol.iterator]();
  };

  get size(){
    this.watch(ANY);
    return this.source.size;
  }
}