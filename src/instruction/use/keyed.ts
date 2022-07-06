import { Controller } from '../../controller';
import { Subscriber } from '../../subscriber';
import { create } from '../../util';
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

  const managed = initial instanceof Map
    ? new StatefulMap(initial, emit)
    : new StatefulSet(initial, emit);

  const context = new WeakMap<Subscriber, typeof managed>();
  const observers = new Set<(key: K) => void>();
  const frozen = new Set<Subscriber>();

  function reset(){
    frozen.clear();
  }

  function emit(key: K){
    control.waiting.add(reset);
    control.update(property);
    observers.forEach(notify => notify(key));
  }

  function init(local: Subscriber){
    const proxy = create(managed);
    const using = new Set<K>();

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

    local.dependant.add({
      commit(){
        if(using.size === 0)
          using.add(ANY);

        observers.add(onEvent);
      },
      release(){
        observers.delete(onEvent);
      }
    })

    local.add(property, false);
    context.set(local, proxy);
    proxy.watch = (key: K) => {
      if(!local.active)
        using.add(key);
    }

    return proxy;
  }

  return {
    value: initial,
    get(local){
      return local ?
        context.get(local) || init(local) :
        managed;
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

export { keyed };

class StatefulSet<T> {
  constructor(
    public source: Set<T>,
    private emit: (key: T | typeof ANY) => void
  ){}

  watch(_key: T | typeof ANY){}

  has(key: T){
    this.watch(key);
    return this.source.has(key);
  };

  add(key: T){
    this.source.add(key);
    this.emit(key);
    return this;
  };

  delete(key: T){
    this.emit(key);
    return this.source.delete(key);
  };

  clear(){
    this.emit(ANY);
    this.source.clear();
  }

  keys(){
    this.watch(ANY);
    return this.source.keys();
  }

  values(){
    this.watch(ANY);
    return this.source.values();
  }

  entries(){
    this.watch(ANY);
    return this.source.entries();
  };

  get size(){
    this.watch(ANY);
    return this.source.size;
  }

  [Symbol.iterator](){
    this.watch(ANY);
    return this.source[Symbol.iterator]();
  };
}

class StatefulMap<K, V> {
  constructor(
    public source: Map<K, V>,
    private emit: (key: K | typeof ANY) => void
  ){}

  watch(_key: K | typeof ANY){}

  has(key: K){
    this.watch(key);
    return this.source.has(key);
  };

  get(key: K){
    this.watch(key);
    return this.source.get(key);
  };

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

  keys(){
    this.watch(ANY);
    return this.source.keys();
  }

  values(){
    this.watch(ANY);
    return this.source.values();
  }

  entries(){
    this.watch(ANY);
    return this.source.entries();
  };

  get size(){
    this.watch(ANY);
    return this.source.size;
  }

  [Symbol.iterator](){
    this.watch(ANY);
    return this.source[Symbol.iterator]();
  };
}