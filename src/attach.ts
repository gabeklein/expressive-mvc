import { apply, Controller } from './controller';
import { Model } from './model';
import { Subscriber } from './subscriber';

type ChildInstruction<T extends Model> =
  (this: Controller, key: string) => () => T | undefined;

export function child<T extends Model>(
  source: ChildInstruction<T>,
  name?: string){

  return apply(
    function child(this: Controller, key: string){
      const context = new WeakMap<Subscriber, any>();
      const current = source.call(this, key);
  
      function subscribe(sub: Subscriber){
        let child: Subscriber | undefined;
    
        function start(){
          const instance = current();
    
          if(instance){
            child = new Subscriber(instance, sub.onUpdate);
      
            if(sub.active)
              child.commit();
      
            sub.dependant.add(child);
            context.set(sub, child.proxy);
          }
        }

        function restart(){
          if(child){
            child.release();
            sub.dependant.delete(child);
            context.set(sub, undefined);
            child = undefined;
          }
    
          start();
        }

        start();
        sub.handle[key] = restart;
      }
    
      return (local: Subscriber | undefined) => {
        if(!local)
          return current();
    
        if(!context.has(local))
          subscribe(local);
    
        return context.get(local);
      }
    },
    name || source.name
  )
}