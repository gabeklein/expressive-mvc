import { Controller } from '../controller';
import { Subscriber } from '../subscriber';
import { apply } from './apply';

declare namespace child {
  type Instruction<T> = (this: Controller, key: string) =>
    ((value: T) => void) | void;
}
  
/**
 * Generic instruction used by `use()` and `tap()` for recursive subscription.
 *
 * @param instruction - Instruction body is run upon parent create. Return function to fetch current value of field.
 * @param name - Name of custom instruction.
 */
function child<T extends {}>(
  instruction: child.Instruction<T>,
  name?: string){

  return apply(
    function child(this: Controller, key: string){
      const context = new WeakMap<Subscriber, any>();
      const set = instruction.call(this, key);
  
      const subscribe = (parent: Subscriber) => {
        let child: Subscriber | undefined;
    
        const init = () => {
          if(child){
            child.release();
            parent.dependant.delete(child);
            context.set(parent, undefined);
            child = undefined;
          }
    
          const instance = this.state[key];
    
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
        set,
        get(value, local){
          if(!local)
            return value;
      
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