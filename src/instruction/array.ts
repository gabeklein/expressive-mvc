import { Subscriber } from "../subscriber";
import { apply } from "./apply"

function array<T = any>(){
  return apply<T[]>(
    function array(key){
      const context = new WeakMap<Subscriber, any>();
      const value: T[] = [];
      const abstract = Object.create(value);

      let lastA = 0;
      let lastB = 0;

      abstract.push = (...items: any[]) => {
        lastA = value.length;
        lastB = value.push(...items);
        this.update(key);
      }

      const subscribe = (parent: Subscriber) => {
        let rangeA = 0;
        let rangeB = 0;

        const local = Object.create(value);
        const update = parent.onUpdate(key, this)!;
        const onUpdate = () => {
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
        value: abstract,
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