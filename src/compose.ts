import { Controller } from './controller';
import { set } from './instructions';
import { issues } from './issues';
import { manage, Model } from './model';
import { Subscriber } from './subscriber';

const Parent = new WeakMap<{}, {}>();

export const Oops = issues({
  ParentRequired: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,

  UnexpectedParent: (expects, child, got) =>
    `New ${child} created as child of ${got}, but must be instanceof ${expects}.`,

  UndefinedNotAllowed: (key) =>
    `Child property ${key} may not be undefined.`
})

export const use = <T extends typeof Model>(
  Peer?: T | (() => InstanceOf<T>),
  argument?: ((i: Model) => void) | boolean
): Model => child(
  function use(key){
    let instance: Model | undefined;

    const update = (next: Model) => {
      instance = next;

      if(next){
        Parent.set(instance, this.subject);
        manage(instance);
      }

      if(typeof argument == "function")
        argument(instance);
      else if(!instance && argument !== false)
        throw Oops.UndefinedNotAllowed(key);
    }

    if(Peer){
      instance = Model.isTypeof(Peer)
        ? new Peer() : Peer();

      if(instance)
        update(instance);
    }
    else
      argument = false;

    this.manage(key, instance, update);

    return () => instance;
  }
);

type ChildInstruction<T extends Model> =
  (this: Controller, key: string) => () => T | undefined;

export const child = <T extends Model>(
  from: ChildInstruction<T>, name?: string): T => {

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
        sub.onUpdate();
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
  }

  return set(child, name || from.name);
}

export const parent = <T extends typeof Model>(
  Expects: T, required?: boolean): InstanceOf<T> => set(

  function parent(){
    const child = this.subject;
    const expected = Expects.name;
    const value = Parent.get(this.subject);

    if(!value){
      if(required)
        throw Oops.ParentRequired(expected, child);
    }
    else if(!(value instanceof Expects))
      throw Oops.UnexpectedParent(expected, child, value);

    return { value };
  }
);