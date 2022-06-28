import { Controller } from '../../controller';
import { Subscriber } from '../../subscriber';
import { create } from '../../util';

const ANY = Symbol("any");

export function managedMap<K, V>(
  control: Controller,
  property: any,
  initial: Map<K, V>){

  const managed = new ManagedMap(initial, emit);
  const context = new WeakMap<Subscriber, ManagedMap<K, V>>();
  const lastUpdate = new Set();

  function reset(){
    lastUpdate.clear();
  }

  function emit(key: any){
    lastUpdate.add(key);
    control.update(property);
    control.waiting.add(reset);
  }

  function setValue(next: Map<K, V>){
    control.state.set(property, next);
    managed.source = next;
    emit(ANY);
  }

  function getValue(local?: Subscriber){
    if(!local)
      return managed;

    if(context.has(local))
      return context.get(local)!;

    const refresh = local.onUpdate(property, control)!;
    const proxy = create(managed) as ManagedMap<K, V>;
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

class ManagedMap<K, V> {
  constructor(
    public source: Map<K, V>,
    private emit: (key: K | typeof ANY) => void
  ){}

  watch(_key: K | typeof ANY){}

  set(key: K, value: V){
    this.source.set(key, value);
    this.emit(key);
    return this;
  };

  delete(key: K){
    this.emit(key);
    return this.source.delete(key);
  };

  clear(){
    this.emit(ANY);
    this.source.clear();
  }

  get(key: K){
    this.watch(key);
    return this.source.get(key);
  };

  has(key: K){
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