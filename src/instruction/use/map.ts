import { Controller } from '../../controller';
import { Subscriber } from '../../subscriber';
import { create } from '../../util';
import { Instruction } from '../apply';

const ANY = Symbol("any");

export function managedMap<K, V>(
  control: Controller,
  property: any,
  initial: Map<K, V>
): Instruction.Descriptor<Map<K, V>> {
  const managed = new ManagedMap(initial, emit);
  const context = new WeakMap<Subscriber, ManagedMap<K, V>>();
  const observers = new Set<(key: K | typeof ANY) => void>();
  const frozen = new Set<Subscriber>();

  function reset(){
    frozen.clear();
  }

  function emit(key: any){
    observers.forEach(notify => notify(key));
    control.update(property);
    control.waiting.add(reset);
  }

  function init(local: Subscriber){
    const proxy = create(managed) as ManagedMap<K, V>;
    const using = new Set();

    observers.add(key => {
      if(frozen.has(local))
        return;

      if(using.has(key) || using.has(ANY) || key === ANY && using.size){
        const refresh = local.onUpdate(property, control);

        if(refresh){
          frozen.add(local);
          refresh()
        }
      }
    });

    local.add(property, false);
    context.set(local, proxy);
    proxy.watch = (key) => {
      if(!local.active)
        using.add(key);
    }

    return proxy;
  }

  return {
    value: initial,
    get(local): any {
      if(!local)
        return managed;
  
      if(context.has(local))
        return context.get(local);

      return init(local);
    },
    set(next){
      managed.source = next;
      control.state.set(property, next);
      emit(ANY);
    },
    destroy(){
      observers.clear();
    }
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