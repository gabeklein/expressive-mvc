import { Controller } from '../../controller';
import { Subscriber } from '../../subscriber';
import { create } from '../../util';
import { Instruction } from '../apply';

const ANY = Symbol("any");

export function managedSet<K>(
  control: Controller,
  property: any,
  initial: Set<K>
): Instruction.Descriptor<Set<K>> {
  const managed = new ManagedSet(initial, emit);
  const context = new WeakMap<Subscriber, ManagedSet<K>>();
  const observers = new Set<(key: K | typeof ANY) => void>();
  const frozen = new Set<Subscriber>();

  function reset(){
    frozen.clear();
  }

  function emit(key: any){
    control.waiting.add(reset);
    control.update(property);
    observers.forEach(notify => notify(key));
  }

  function init(local: Subscriber){
    const proxy = create(managed) as ManagedSet<K>;
    const using = new Set();

    function onEvent(key: K | typeof ANY){
      if(frozen.has(local))
        return;

      if(using.has(key) || using.has(ANY) || key === ANY && using.size){
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
    proxy.watch = (key) => {
      if(!local.active)
        using.add(key);
    }

    return proxy;
  }

  return {
    value: initial,
    get(local): any {
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

class ManagedSet<T> {
  constructor(
    public source: Set<T>,
    private emit: (key: T | typeof ANY) => void
  ){}

  watch(_key: T | typeof ANY){}

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