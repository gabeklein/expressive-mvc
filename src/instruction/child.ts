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
 * @param instruction - Instruction body is run upon parent create. Return function to fetch current value of field.
 * @param name - Name of custom instruction.
 */
function child<T extends Model>(
  instruction: child.Instruction<T>,
  name?: string){

  return apply(
    function child(this: Controller, key: string){
      const context = new WeakMap<Subscriber, any>();
      const source = instruction.call(this, key);
  
      function subscribe(parent: Subscriber){
        let child: Subscriber | undefined;
    
        function init(){
          if(child){
            child.release();
            parent.dependant.delete(child);
            context.set(parent, undefined);
            child = undefined;
          }
    
          const instance = source.get();
    
          if(instance){
            child = new Subscriber(instance, parent.onUpdate);
      
            if(parent.active)
              child.commit();
      
            parent.dependant.add(child);
            context.set(parent, child.proxy);
          }
        }

        init();
        parent.watch[key] = init;
      }
    
      return {
        value: source.get(),
        set: source.set,
        get(_value, local){
          if(!local)
            return source.get();
      
          if(!context.has(local))
            subscribe(local);
      
          return context.get(local);
        }
      }
    },
    name || instruction.name
  )
}

export { child }