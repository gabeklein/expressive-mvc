import { apply, Controller } from './controller';
import { Model } from './model';
import { Subscriber } from './subscriber';

type ChildInstruction<T extends Model> =
  (this: Controller, key: string) => () => T | undefined;

export function child<T extends Model>(
  from: ChildInstruction<T>, name?: string){

  return apply(
    function child(this: Controller, key: string){
      const proxyCache = new WeakMap<Subscriber, any>();
      const getCurrent = from.call(this, key);
  
      function subscribe(sub: Subscriber){
        let child: Subscriber | undefined;
    
        function start(){
          const instance = getCurrent();
    
          if(instance){
            child = new Subscriber(instance, sub.onUpdate);
      
            if(sub.active)
              child.commit();
      
            sub.dependant.add(child);
            proxyCache.set(sub, child.proxy);
          }
        }

        function refresh(){
          if(child){
            child.release();
            sub.dependant.delete(child);
            proxyCache.set(sub, undefined);
            child = undefined;
          }
    
          start();
        }
    
        start();
        sub.follow(key, refresh);
      }
    
      return (local: Subscriber | undefined) => {
        if(!local)
          return getCurrent();
    
        if(!proxyCache.has(local))
          subscribe(local);
    
        return proxyCache.get(local);
      }
    },
    name || from.name
  )
}