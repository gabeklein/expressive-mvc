import { Subscriber } from '../../subscriber';
import { Callback } from '../../types';
import { apply } from '../apply';

class Managed<T> extends Array<T> {
  lastUpdate = [0, 0];

  update: (from: number, to: number) => void;

  constructor(onUpdate: Callback){
    super();

    this.update = (from: number, to: number) => {
      this.lastUpdate = [from, to];
      onUpdate();
    }
  }

  push(...items: T[]): number {
    const { length } = this;
    const end = super.push(...items);

    this.update(length, end);
    return end;
  }

  unshift(...items: T[]): number {
    const end = super.push(...items);

    this.update(0, end);
    return end;
  }

  splice(start: number, deleteCount?: number): T[];
  splice(start: number, deleteCount: number, ...items: T[]): T[];
  splice(start: any, deleteCount: any, ...rest: any[]): T[] {
    const end =
      deleteCount !== rest.length ? Infinity : deleteCount;

    this.update(start, end);

    return super.splice(start, deleteCount, ...rest);
  }
}

function array<T = any>(){
  return apply<T[]>(
    function array(key){
      const context = new WeakMap<Subscriber, T>();
      const array = new Managed<T>(() => this.update(key));

      const getLocal = (context: Subscriber) => {
        const proxy = Object.create(array);
        const update = context.onUpdate(key, this)!;

        let rangeA = 0;
        let rangeB = 0;

        const onUpdate = () => {
          const [lastA, lastB] = array.lastUpdate;

          if(rangeA <= lastB && rangeB >= lastA)
            return update;
        }

        const listen = (eventA: number, eventB: number) => {
          if(context.active)
            return;

          context.using.set(key, onUpdate);
          rangeA = Math.min(rangeA, eventA);
          rangeB = Math.max(rangeB, eventB);
        }

        proxy[Symbol.iterator] = () => {
          listen(0, Infinity);
          return array[Symbol.iterator]();
        }

        return proxy;
      }

      return {
        value: array,
        set: false,
        get: (local: Subscriber | undefined) => {
          if(!local)
            return this.state.get(key);

          if(context.has(local))
            return context.get(local);
            
          const output = getLocal(local);

          context.set(local, output);

          return output;
        }
      }
    }
  )
}

export { array }