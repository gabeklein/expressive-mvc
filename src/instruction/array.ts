import { Stateful } from '../model';
import { Subscriber } from '../subscriber';
import { Callback } from '../types';
import { apply } from './apply';

interface Managed<T> extends Stateful {}

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
    const length = this.length;
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
    this.update(start, deleteCount !== rest.length ? Infinity : deleteCount);

    return super.splice(start, deleteCount, ...rest);
  }
}

function array<T = any>(){
  return apply<T[]>(
    function array(key){
      const context = new WeakMap<Subscriber, any>();
      const value = new Managed<T>(() => this.update(key));

      const subscribe = (parent: Subscriber) => {
        let rangeA = 0;
        let rangeB = 0;

        const local = Object.create(value);
        const update = parent.onUpdate(key, this)!;
        const onUpdate = () => {
          const [lastA, lastB] = value.lastUpdate;

          if(rangeA <= lastB && rangeB >= lastA)
            return update;
        }

        function listen(eventA: number, eventB: number){
          if(!parent.active){
            parent.watch[key] = onUpdate;
            rangeA = Math.min(rangeA, eventA);
            rangeB = Math.max(rangeB, eventB);
          }
        }

        local[Symbol.iterator] = () => {
          listen(0, Infinity);
          return value[Symbol.iterator]();
        }

        context.set(parent, local);
      }
      
      return {
        value,
        set: false,
        get(value, local){
          if(!local)
            return value;

          if(!context.has(local))
            subscribe(local);

          return context.get(local);
        }
      }
    }
  )
}

export { array }