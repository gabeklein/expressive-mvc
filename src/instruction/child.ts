import { Controller } from '../controller';
import { apply } from './apply';
import { Model } from '../model';
import { Subscriber } from '../subscriber';

declare namespace child {
  type Instruction<T> = (this: Controller, key: string) => {
    get: () => T | undefined,
    set?: (value: T | undefined) => void
  }
}
  
/**
 * Generic instruction used by `use()` and `tap()` for recursive subscription.
 *
 * @param source - Instruction body is run upon parent create. Return function to fetch current value of field.
 * @param name - Name of custom instruction.
 */
function child<T extends Model>(
  source: child.Instruction<T>,
  name?: string){

  return apply(
    function child(this: Controller, key: string){
      const context = new WeakMap<Subscriber, any>();
      const peer = source.call(this, key);
  
      function subscribe(sub: Subscriber){
        let child: Subscriber | undefined;
    
        function init(){
          if(child){
            child.release();
            sub.dependant.delete(child);
            context.set(sub, undefined);
            child = undefined;
          }
    
          const instance = peer.get();
    
          if(instance){
            child = new Subscriber(instance, sub.onUpdate);
      
            if(sub.active)
              child.commit();
      
            sub.dependant.add(child);
            context.set(sub, child.proxy);
          }
        }

        init();
        sub.watch[key] = init;
      }
    
      return {
        value: peer.get(),
        set: peer.set,
        get(_value, local){
          if(!local)
            return peer.get();
      
          if(!context.has(local))
            subscribe(local);
      
          return context.get(local);
        }
      }
    },
    name || source.name
  )
}

export { child }