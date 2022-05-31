import { Callback } from '../types';
import { apply, forSubscriber } from './apply';

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
      const array = new Managed<T>(() => this.update(key));
      const access = forSubscriber(context => {
        const local = Object.create(array);
        const update = context.onUpdate(key, this)!;

        let rangeA = 0;
        let rangeB = 0;

        function onUpdate(){
          const [lastA, lastB] = array.lastUpdate;

          if(rangeA <= lastB && rangeB >= lastA)
            return update;
        }

        function listen(eventA: number, eventB: number){
          if(context.active)
            return;

          context.watch[key] = onUpdate;
          rangeA = Math.min(rangeA, eventA);
          rangeB = Math.max(rangeB, eventB);
        }

        local[Symbol.iterator] = () => {
          listen(0, Infinity);
          return array[Symbol.iterator]();
        }

        return local;
      })

      return {
        get: access,
        set: false,
        value: array
      }
    }
  )
}

export { array }