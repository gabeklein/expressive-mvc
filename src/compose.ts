import { Controller, set } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { Subscriber } from './subscriber';
import { name } from './util';

const ParentRelationship = new WeakMap<{}, {}>();

export const Oops = issues({
  ParentRequired: (expects, child) => 
    `New ${child} created standalone but requires parent of type ${expects}. Did you remember to create via use(${child})?`,

  UnexpectedParent: (expects, child, got) =>
    `New ${child} created as child of ${got}, but must be instanceof ${expects}.`
})

export function use<T extends typeof Model>
  (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> {

  type Cache = { proxy?: any };

  return set((on: Controller, key) => {
    let instance = new Peer() as InstanceOf<T>;

    function update(current: InstanceOf<T>){
      instance = current;

      if(current){
        ParentRelationship.set(instance, on.subject);
        Controller.ensure(instance);
    
        if(callback)
          callback(instance);
      }
    }

    function setup(sub: Subscriber, cached: Cache){
      const { dependant } = sub;
      let reset: Callback | undefined;

      function subscribe(){
        const child = new Subscriber(
          instance, sub.callback, sub.info
        );

        if(sub.active)
          child.listen();

        dependant.add(child);

        cached.proxy = child.proxy;
        reset = () => {
          child.release();
          dependant.delete(child);
          reset = undefined;
        }
      }

      subscribe();
      sub.follow(key, () => {
        if(reset)
          reset();
        
        if(instance)
          subscribe();

        sub.callback();
      });
    }

    update(instance);
    on.register(key, instance, update);

    return (current: Subscriber, cache: Cache) => {
      if(!current)
        return instance;

      if(!("proxy" in cache))
        setup(current, cache);

      return cache.proxy;
    }
  })
}

export function parent<T extends typeof Model>
  (Expects: T, required?: boolean): InstanceOf<T> {

  return set(({ subject }) => {
    const expectsType = Expects.name;
    const onType = name(subject);
    const parent = ParentRelationship.get(subject);

    if(!parent){
      if(required)
        throw Oops.ParentRequired(expectsType, onType);
    }
    else if(!(parent instanceof Expects))
      throw Oops.UnexpectedParent(expectsType, onType, name(parent));

    return { value: parent };
  })
}